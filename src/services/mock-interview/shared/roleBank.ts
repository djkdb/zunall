/**
 * Role question repository and retrieval.
 *
 * Thousands of questions never travel together: the bank is split per domain
 * (public/data/roles/<domain>.json) plus a common file, loaded on demand and cached.
 * For each next question we narrow down in order — role → type → category →
 * difficulty/level → not-yet-asked — and hand back a short ranked candidate list
 * (20–50) that the mock interviewer picks from or the AI prompt receives.
 */
import type { Difficulty, ExperienceLevel, Language, QuestionType } from "./schemas";
import type { PackedQuestionFile, QuestionBasis, RoleProfileDetail, RoleQuestion, SourceType } from "./roleTypes";
import { familyOf, getRole, rolesInFamily, type RoleContext } from "./roles";
import { fingerprint, sameQuestion, type QuestionFingerprint } from "./similarity";
import { fillSlots } from "./korean";
import { loadData } from "./dataLoader";

/* ─────────────────────────────── loading ────────────────────────────── */

const load = <T>(file: string) => loadData<T>(`roles/${file}`);

const SOURCE_OF_BASIS: Record<QuestionBasis, SourceType> = {
  공개후기: "interview_review",
  공식자료: "official_recruitment",
  공고기반: "job_description",
  직무기반: "role_research",
  일반면접: "role_research",
};

const unpacked = new Map<string, RoleQuestion[]>();

export async function loadQuestionFile(name: string): Promise<RoleQuestion[]> {
  const hit = unpacked.get(name);
  if (hit) return hit;
  const f = await load<PackedQuestionFile>(`${name}.json`);
  const out = (f.questions ?? []).map((q): RoleQuestion => {
    const source = q.r !== undefined ? f.sources[q.r] : undefined;
    return {
      text: q.t,
      ...(q.en ? { en: q.en } : {}),
      scope: q.s,
      category: q.c,
      type: q.y,
      difficulty: q.d,
      ...(q.l ? { levels: q.l } : {}),
      basis: q.b,
      sourceType: source?.type ?? SOURCE_OF_BASIS[q.b],
      ...(source ? { source } : {}),
      confidence: q.cf,
    };
  });
  unpacked.set(name, out);
  return out;
}

export const loadCommonQuestions = () => loadQuestionFile("common");

export async function loadProfiles(): Promise<Record<string, RoleProfileDetail>> {
  return load<Record<string, RoleProfileDetail>>("profiles.json");
}

/** Profile for the job: the taxonomy role's, the anchor's, merged with an inferred profile. */
export async function loadRoleProfile(ctx: RoleContext): Promise<RoleProfileDetail | null> {
  const id = ctx.role?.id ?? ctx.anchor?.id;
  let base: RoleProfileDetail | null;
  try {
    base = id ? ((await loadProfiles())[id] ?? null) : null;
  } catch {
    base = null;
  }
  if (!ctx.custom) return base;
  const merge = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];
  return {
    skills: merge(ctx.custom.skills, base?.skills).slice(0, 10),
    responsibilities: base?.responsibilities ?? [],
    keywords: merge(ctx.custom.topics, base?.keywords).slice(0, 24),
    topics: {
      role: merge(ctx.custom.topics, base?.topics.role).slice(0, 10),
      scenario: base?.topics.scenario ?? [],
      result: base?.topics.result ?? [],
      en: base?.topics.en ?? [],
    },
  };
}

/* ─────────────────────────────── visibility ─────────────────────────── */

/** How strongly each scope speaks to this job (0 = not visible). */
export function scopeWeight(scope: string, ctx: RoleContext): number {
  if (scope === "common") return 0.5;
  const [kind, id] = scope.split(":");
  if (kind === "domain") return ctx.domain?.id === id ? 0.65 : 0;
  if (kind === "family") return ctx.family?.id === id ? 0.85 : 0;
  if (kind === "role") {
    if (ctx.role?.id === id) return 1;
    if (ctx.anchor?.id === id) return 0.6;
    // Family-level context ("마케팅", "간호"): the family's roles are all fair game.
    if (!ctx.role && ctx.family && rolesInFamily(ctx.family.id).some((r) => r.id === id)) return 0.6;
  }
  return 0;
}

/** Every question this job can be asked: common + its domain file, filtered to visible scopes. */
export async function questionPool(ctx: RoleContext): Promise<RoleQuestion[]> {
  const [common, domain] = await Promise.all([loadCommonQuestions().catch(() => []), ctx.domain ? loadQuestionFile(ctx.domain.id).catch(() => []) : Promise.resolve([])]);
  return [...common, ...domain.filter((q) => scopeWeight(q.scope, ctx) > 0)];
}

/* ─────────────────────────────── retrieval ──────────────────────────── */

export interface RetrieveOptions {
  ctx: RoleContext;
  /** Preferred question types, best first. */
  types: QuestionType[];
  difficulty: Difficulty;
  experience: ExperienceLevel;
  language: Language;
  /** Questions already asked (never repeat, even reworded). */
  asked: string[];
  /** Categories already covered — prefer new ones. */
  usedCategories?: string[];
  limit?: number;
  /** Varies the order among equally good candidates. */
  seed?: number;
  /** Only the role's own questions (no common bank). */
  roleOnly?: boolean;
}

export interface Candidate {
  q: RoleQuestion;
  /** Question text with {role} filled in (English text for English interviews when available). */
  text: string;
  score: number;
}

const fpCache = new Map<string, QuestionFingerprint>();
const fp = (t: string) => {
  let f = fpCache.get(t);
  if (!f) {
    f = fingerprint(t);
    if (fpCache.size > 20000) fpCache.clear();
    fpCache.set(t, f);
  }
  return f;
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** "{role} 직무" → "회계(재무회계) 직무" with a matching particle. */
export function fillRole(text: string, title: string): string {
  return fillSlots(text, { role: title });
}

/**
 * For a job we only approximated with a nearby role ("방송 기술감독" ≈ 방송 PD), that role's own
 * questions may name it ("PD를 택한 이유") — those would be wrong for the candidate. Keep only
 * the anchor's questions that don't name the anchor's job.
 */
function namesOtherJob(q: RoleQuestion, ctx: RoleContext): boolean {
  if (ctx.role || !q.scope.startsWith("role:")) return false;
  const a = getRole(q.scope.slice(5));
  if (!a) return false;
  if (q.type === "motivation" || q.type === "role_understanding") return true;
  const own = ctx.title.replace(/\s/g, "").toLowerCase();
  const names = [a.ko.replace(/\s*\(.*?\)/g, ""), ...a.ko.split(/[·()]/), ...a.aliases]
    .map((n) => n.replace(/\s/g, "").toLowerCase())
    .filter((n) => n.length >= 2 && !own.includes(n));
  const text = q.text.replace(/\s/g, "").toLowerCase();
  return names.some((n) => text.includes(n));
}

export function rankCandidates(pool: RoleQuestion[], o: RetrieveOptions): Candidate[] {
  const askedFps = o.asked.map(fp);
  const used = new Set(o.usedCategories ?? []);
  const typeRank = new Map(o.types.map((t, i) => [t, i]));
  const out: Candidate[] = [];
  for (const q of pool) {
    const w = scopeWeight(q.scope, o.ctx);
    if (!w || (o.roleOnly && q.scope === "common")) continue;
    const ti = typeRank.get(q.type);
    if (ti === undefined || namesOtherJob(q, o.ctx)) continue;
    if (o.language === "en" && q.scope !== "common" && !q.en) continue;
    let score = w + Math.max(0.3, 1.2 - ti * 0.3);
    if (q.difficulty === o.difficulty) score += 0.15;
    else if ((q.difficulty === "hard" && o.difficulty === "easy") || (q.difficulty === "easy" && o.difficulty === "hard")) score -= 0.25;
    if (q.levels) score += q.levels.includes(o.experience) ? 0.05 : -0.6;
    if (used.has(q.category)) score -= 0.2;
    if (q.basis === "공개후기" || q.basis === "공식자료" || q.basis === "공고기반") score += 0.05;
    score += (hash(`${o.seed ?? 0}:${q.text}`) % 100) / 1000;
    const text = fillRole(o.language === "en" && q.en ? q.en : q.text, o.language === "en" ? o.ctx.titleEn : o.ctx.title);
    if (askedFps.some((a) => sameQuestion(fp(text), a))) continue;
    out.push({ q, text, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, o.limit ?? 30);
}

export async function retrieveQuestions(o: RetrieveOptions): Promise<Candidate[]> {
  return rankCandidates(await questionPool(o.ctx), o);
}

/** Fallback types to widen the search when a type has no fresh questions left. */
export const RELATED_TYPES: Record<QuestionType, QuestionType[]> = {
  opening: ["motivation"],
  motivation: ["role_understanding", "company_understanding"],
  role_understanding: ["role_specific", "motivation"],
  company_understanding: ["motivation", "industry"],
  behavioral: ["experience", "communication", "leadership"],
  experience: ["behavioral", "deep_dive", "result"],
  deep_dive: ["experience", "behavioral"],
  situational: ["case", "ethics", "challenge"],
  role_specific: ["technical", "case", "situational", "role_understanding"],
  technical: ["role_specific", "case", "analytical"],
  case: ["analytical", "situational", "role_specific"],
  numerical: ["analytical", "case"],
  analytical: ["case", "numerical", "role_specific"],
  industry: ["role_understanding", "case"],
  leadership: ["behavioral", "communication"],
  communication: ["behavioral", "situational"],
  ethics: ["situational", "behavioral"],
  challenge: ["situational", "case"],
  reflection: ["behavioral", "experience"],
  result: ["experience", "behavioral"],
  pt: ["case", "debate"],
  debate: ["pt", "case"],
};

/** Type list for retrieval: the wanted type, then its relatives. */
export function typesFor(t: QuestionType): QuestionType[] {
  return [t, ...RELATED_TYPES[t]];
}

/** Quick stats for the debug panel: what this job's bank holds. */
export async function poolStats(ctx: RoleContext): Promise<{ total: number; roleLevel: number; types: Record<string, number>; categories: number }> {
  const pool = await questionPool(ctx);
  const types: Record<string, number> = {};
  for (const q of pool) types[q.type] = (types[q.type] ?? 0) + 1;
  const ownScopes = new Set([ctx.role ? `role:${ctx.role.id}` : "", ctx.family ? `family:${ctx.family.id}` : "", ctx.domain ? `domain:${ctx.domain.id}` : ""]);
  return { total: pool.length, roleLevel: pool.filter((q) => ownScopes.has(q.scope)).length, types, categories: new Set(pool.map((q) => q.category)).size };
}

/** Family of a role context's anchor, for display. */
export function contextFamilyName(ctx: RoleContext): string {
  return ctx.family?.name ?? (ctx.anchor ? familyOf(ctx.anchor).name : "");
}
