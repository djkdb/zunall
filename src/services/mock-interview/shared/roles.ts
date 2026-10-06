/**
 * Role taxonomy access, search and the RoleResolver.
 *
 *   Domain (51)  →  Job family  →  Role (e.g. 회계·재무·세무 → 회계 → 관리회계·원가)
 *
 * Any job title resolves to a RoleContext — never to a generic "general" bucket
 * when there is anything to go on:
 *   1. an exact alias ("FE", "데이터 애널", "HRD", "BM")        → that role
 *   2. a family/domain name ("마케팅", "간호", "공기업")          → that family
 *   3. a fuzzy match ("프론트엔드개발", "회계담당")                → the closest role
 *   4. anything else ("반도체 공정 장비 셋업", "방송 기술감독")    → a practice profile inferred
 *      from domain keywords (or by the AI in AI mode — see server/prompts/rolePrompt.ts)
 */
import type { Archetype, CustomRole, Language } from "./schemas";
import type { DomainEntry, FamilyEntry, RoleEntry, RoleGroup } from "./roleTypes";
import { ROLE_TAXONOMY } from "./data/roles";
import { lexicalSimilarity } from "./similarity";

export const ROLE_GROUPS: RoleGroup[] = ROLE_TAXONOMY.groups;
export const DOMAINS: DomainEntry[] = ROLE_TAXONOMY.domains;
export const FAMILIES: FamilyEntry[] = ROLE_TAXONOMY.families;
export const ROLES: RoleEntry[] = ROLE_TAXONOMY.roles;
export const ROLE_STATS = ROLE_TAXONOMY.stats;

const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));
const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));
const DOMAIN_BY_ID = new Map(DOMAINS.map((d) => [d.id, d]));

export const getRole = (id: string | null | undefined): RoleEntry | null => (id ? (ROLE_BY_ID.get(id) ?? null) : null);
export const getFamily = (id: string | null | undefined): FamilyEntry | null => (id ? (FAMILY_BY_ID.get(id) ?? null) : null);
export const getDomain = (id: string | null | undefined): DomainEntry | null => (id ? (DOMAIN_BY_ID.get(id) ?? null) : null);
export const familyOf = (r: RoleEntry): FamilyEntry => FAMILY_BY_ID.get(r.family)!;
export const domainOf = (r: RoleEntry): DomainEntry => DOMAIN_BY_ID.get(familyOf(r).domain)!;
export const rolesInFamily = (familyId: string): RoleEntry[] => ROLES.filter((r) => r.family === familyId);
export const familiesInDomain = (domainId: string): FamilyEntry[] => FAMILIES.filter((f) => f.domain === domainId);
export const domainsInGroup = (groupId: string): DomainEntry[] => DOMAINS.filter((d) => d.group === groupId);
export const rolesInDomain = (domainId: string): RoleEntry[] => ROLES.filter((r) => familyOf(r).domain === domainId);

export function roleTitle(r: RoleEntry, lang: Language = "ko"): string {
  return lang === "en" ? r.en : r.ko;
}

/* ─────────────────────────────── search ─────────────────────────────── */

/** "프론트엔드 개발자" / "프론트엔드개발자" / "Frontend developer" → comparable key. */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[()[\]{}·,./\\|&+\-_'"`~!?:;]/g, " ")
    .replace(/\s+/g, "")
    .replace(/(?:직무|직군|분야|업무|포지션|채용|지원|신입|경력|담당자|담당|쪽|계열)$/u, "");
}

interface IndexedRole {
  role: RoleEntry;
  keys: string[];
  family: FamilyEntry;
  domain: DomainEntry;
  famKey: string;
  domKey: string;
}
const INDEX: IndexedRole[] = ROLES.map((role) => {
  const family = FAMILY_BY_ID.get(role.family)!;
  const domain = DOMAIN_BY_ID.get(family.domain)!;
  return {
    role,
    family,
    domain,
    keys: [...new Set([role.ko, role.en, ...role.aliases].map(normalizeTitle).filter((k) => k.length >= 2))],
    famKey: normalizeTitle(family.name) + " " + normalizeTitle(family.nameEn),
    domKey: normalizeTitle(domain.name) + " " + normalizeTitle(domain.nameEn),
  };
});

/**
 * Broad words that name a whole area rather than a job. Searching them lists the
 * area's roles ("어떤 업무에 가까운가요?") instead of guessing one.
 */
export const BROAD_TERMS: Record<string, { label: string; roles: string[] }> = {
  사무직: { label: "사무직", roles: ["office_admin", "general_affairs", "business_management", "hr_planner", "accountant", "sales_manager", "business_planner"] },
  사무: { label: "사무", roles: ["office_admin", "general_affairs", "business_management", "accountant", "trade_admin", "sales_manager"] },
  경영지원: { label: "경영지원", roles: ["business_management", "general_affairs", "hr_planner", "accountant", "finance_manager"] },
  기획: { label: "기획", roles: ["strategy_planner", "business_planner", "corporate_planner", "service_planner", "product_manager", "content_planner", "edu_planner"] },
  개발: { label: "개발", roles: ["frontend", "backend", "fullstack", "ios", "android", "game_client", "devops", "embedded_sw", "data_engineer"] },
  개발자: { label: "개발자", roles: ["frontend", "backend", "fullstack", "ios", "android", "game_client", "game_server", "devops", "embedded_sw", "data_engineer"] },
  엔지니어: { label: "엔지니어", roles: ["backend", "devops", "semi_process", "process_engineer", "mechanical_designer", "electrical_engineer", "quality_assurance", "chemical_process"] },
  공정엔지니어: { label: "공정 엔지니어", roles: ["process_engineer", "chemical_process", "semi_process", "battery_engineer", "production_engineer"] },
  공정: { label: "공정", roles: ["process_engineer", "chemical_process", "semi_process", "battery_engineer", "production_engineer"] },
  연구원: { label: "연구원", roles: ["research_scientist", "bio_researcher", "materials_researcher", "chemical_researcher", "ai_researcher", "policy_researcher", "gov_researcher", "food_researcher"] },
  연구개발: { label: "연구개발", roles: ["product_developer", "rnd_planner", "mechanical_designer", "hw_engineer", "materials_researcher", "bio_researcher", "automotive_engineer"] },
  마케팅: { label: "마케팅", roles: ["performance_marketer", "brand_marketer", "content_marketer", "crm_marketer", "growth_marketer", "product_marketer", "pr_specialist"] },
  마케터: { label: "마케터", roles: ["performance_marketer", "brand_marketer", "content_marketer", "crm_marketer", "growth_marketer", "product_marketer"] },
  영업: { label: "영업", roles: ["domestic_sales", "b2b_sales", "overseas_sales", "technical_sales", "solution_sales", "sales_manager", "key_account"] },
  디자이너: { label: "디자이너", roles: ["ux_designer", "ui_designer", "product_designer", "graphic_designer", "industrial_designer", "interior_designer", "fashion_designer"] },
  디자인: { label: "디자인", roles: ["ux_designer", "ui_designer", "product_designer", "graphic_designer", "industrial_designer", "interior_designer", "fashion_designer"] },
  금융: { label: "금융", roles: ["bank_teller", "private_banker", "relationship_manager", "credit_analyst", "securities", "asset_manager", "risk_manager", "underwriter"] },
  은행: { label: "은행", roles: ["bank_teller", "private_banker", "relationship_manager", "credit_analyst"] },
  보험: { label: "보험", roles: ["underwriter", "actuary", "claims_adjuster"] },
  의료: { label: "의료", roles: ["nurse", "physician", "pharmacist", "hospital_admin", "physical_therapist", "clinical_lab_scientist", "radiologic_technologist"] },
  보건: { label: "보건", roles: ["public_health_officer", "health_manager", "physical_therapist", "clinical_lab_scientist", "dental_hygienist", "dietitian"] },
  공기업: { label: "공기업", roles: ["pe_admin", "pe_electrical", "pe_mechanical", "pe_civil", "pe_it"] },
  공공기관: { label: "공공기관", roles: ["public_institution_staff", "pe_admin", "research_admin", "ngo_program"] },
  공무원: { label: "공무원", roles: ["admin_civil_servant", "tech_civil_servant", "tax_official", "police_officer", "firefighter"] },
  교사: { label: "교사", roles: ["elementary_teacher", "secondary_teacher", "special_ed_teacher", "early_childhood_teacher"] },
  선생님: { label: "선생님", roles: ["elementary_teacher", "secondary_teacher", "academy_instructor", "early_childhood_teacher"] },
  생산직: { label: "생산", roles: ["production_manager", "production_engineer", "shop_floor_supervisor", "maintenance_engineer", "quality_control"] },
  제조: { label: "제조", roles: ["production_manager", "production_engineer", "process_engineer", "quality_control", "maintenance_engineer"] },
  서비스직: { label: "서비스", roles: ["cs_agent", "hotelier", "flight_attendant", "ground_staff", "restaurant_manager", "store_manager"] },
  기술직: { label: "기술직", roles: ["tech_civil_servant", "pe_electrical", "pe_mechanical", "pe_civil", "maintenance_engineer", "production_engineer"] },
  it: { label: "IT", roles: ["frontend", "backend", "devops", "data_analyst", "security_engineer", "service_planner", "qa_engineer"] },
  데이터: { label: "데이터", roles: ["data_analyst", "data_engineer", "data_scientist", "bi_analyst", "ml_engineer", "ai_pm"] },
  건설: { label: "건설", roles: ["building_construction", "civil_construction", "architect", "civil_designer", "construction_safety", "cost_estimator"] },
  문과: { label: "문과 계열", roles: ["business_planner", "hr_planner", "accountant", "domestic_sales", "performance_marketer", "general_affairs", "pr_specialist"] },
};

export interface RoleMatch {
  role: RoleEntry;
  family: FamilyEntry;
  domain: DomainEntry;
  score: number;
  /** The alias that matched, when it isn't the title. */
  via?: string;
}

const dice = (a: string, b: string) => lexicalSimilarity(a, b);

function scoreRole(ix: IndexedRole, q: string): { score: number; via?: string } {
  let best = 0;
  let via: string | undefined;
  for (const k of ix.keys) {
    let s = 0;
    if (k === q) s = 100;
    else if (k.startsWith(q)) s = 80 - Math.min(20, k.length - q.length);
    else if (k.includes(q)) s = 65 - Math.min(20, k.length - q.length);
    else if (q.includes(k) && k.length >= 2) s = 55 + Math.min(20, k.length * 2);
    else {
      const d = dice(k, q);
      if (d >= 0.34) s = Math.round(d * 60);
    }
    if (s > best) {
      best = s;
      via = k;
    }
  }
  if (ix.famKey.includes(q)) best = Math.max(best, 42);
  if (ix.domKey.includes(q)) best = Math.max(best, 36);
  const title = normalizeTitle(ix.role.ko);
  return { score: best, via: via && via !== title && via !== normalizeTitle(ix.role.en) ? via : undefined };
}

/** Fuzzy role search across titles, aliases, families and domains. */
export function searchRoles(query: string, limit = 12): RoleMatch[] {
  const q = normalizeTitle(query);
  if (!q) return [];
  const broad = BROAD_TERMS[q];
  const out: RoleMatch[] = [];
  for (const ix of INDEX) {
    const scored = scoreRole(ix, q);
    let score = scored.score;
    const via = scored.via;
    if (broad?.roles.includes(ix.role.id)) score = Math.max(score, 70 - broad.roles.indexOf(ix.role.id));
    if (score >= 20) out.push({ role: ix.role, family: ix.family, domain: ix.domain, score, via });
  }
  const aliasOf = (m: RoleMatch) => m.role.aliases.find((a) => normalizeTitle(a) === m.via);
  return out
    .sort((a, b) => b.score - a.score || a.role.ko.length - b.role.ko.length)
    .slice(0, limit)
    .map((m) => ({ ...m, via: m.via ? (aliasOf(m) ?? m.via) : undefined }));
}

/* ─────────────────────────────── resolver ───────────────────────────── */

export type ResolveKind = "role" | "family" | "broad" | "inferred" | "none";

export interface Resolution {
  kind: ResolveKind;
  role: RoleEntry | null;
  family: FamilyEntry | null;
  domain: DomainEntry | null;
  /** Other roles worth suggesting ("비슷한 직무"). */
  suggestions: RoleEntry[];
  /** The input names a whole area ("사무직") — ask which job it's closest to. */
  broad: boolean;
}

/** Domain hints for titles we don't list — ordered, first match wins. */
const DOMAIN_HINTS: [RegExp, string][] = [
  [/반도체|웨이퍼|팹|\bfab\b|포토|식각|증착|\bcmp\b|수율/i, "electronics"],
  [/디스플레이|oled|lcd|회로|\bpcb\b|전자|전장|하드웨어/i, "electronics"],
  [/자동차|차량|모빌리티|기계|메카|로봇|설비설계|금형|유압/i, "mechanical"],
  [/2차\s?전지|배터리|화학|화공|소재|고분자|촉매|석유/i, "chemical"],
  [/바이오|제약|의약|신약|임상|세포|항체|\bgmp\b/i, "bio"],
  [/간호|병동|수술실|응급실|중환자/i, "medical"],
  [/의사|전공의|약사|병원|의료|원무|코디네이터/i, "medical"],
  [/치료사|임상병리|방사선|치위생|영양사|보건|재활/i, "health_tech"],
  [/사회복지|복지|요양|돌봄|청소년/i, "welfare"],
  [/상담|심리|코칭/i, "counseling"],
  [/교사|교원|강사|교육|튜터|보육|유치원|학원/i, "education"],
  [/공무원|주무관|행정직|경찰|소방|군무원|부사관|장교/i, "public_admin"],
  [/공사|공단|공기업|한전|코레일/i, "public_enterprise"],
  [/\bngo\b|비영리|재단|모금|후원/i, "nonprofit"],
  [/정책|연구소|출연연|연구기관/i, "research_institute"],
  [/회계|세무|재무|자금|원가|결산|감사|fp&a|\bir\b/i, "accounting"],
  [/은행|증권|보험|자산운용|투자|펀드|카드사|캐피탈|금융|애널리스트/i, "finance"],
  [/법무|변호사|법률|컴플라이언스|준법|개인정보|특허/i, "legal"],
  [/인사|채용|\bhr|노무|조직문화|교육담당|평가보상/i, "hr"],
  [/총무|비서|사무|행정|경영지원|자산관리|시설/i, "admin"],
  [/전략|경영기획|사업기획|신사업|컨설|m&a/i, "strategy"],
  [/광고|마케팅|마케터|브랜드|홍보|\bpr\b|퍼포먼스|그로스|\bcrm\b|콘텐츠 ?마케팅/i, "marketing"],
  [/해외영업|무역|수출|수입|포워딩|통관/i, "trade"],
  [/영업|세일즈|sales|어카운트|대리점/i, "sales"],
  [/\bmd\b|머천|바이어|상품기획/i, "md"],
  [/구매|조달|소싱|purchas|procure/i, "purchasing"],
  [/물류|scm|창고|배송|수급|유통관리|운송/i, "logistics"],
  [/\bcs\b|고객센터|상담원|콜센터|고객지원|\bcx\b/i, "cs"],
  [/기획자|\bpm\b|\bpo\b|프로덕트|서비스기획/i, "product"],
  [/데이터|\bai\b|인공지능|머신러닝|딥러닝|\bml\b|\bllm\b|분석가/i, "data_ai"],
  [/보안|인프라|클라우드|네트워크|서버|시스템|devops|\bsre\b|\bdba\b/i, "infra"],
  [/게임/i, "game"],
  [/개발자|개발|프로그래머|소프트웨어|앱|웹|프론트|백엔드|\bqa\b/i, "software"],
  [/디자이너|디자인|\bux\b|\bui\b|그래픽|일러스트/i, "design"],
  [/\bpd\b|방송|영상|촬영|편집|아나운서|유튜브/i, "broadcast"],
  [/기자|에디터|편집자|출판|카피|콘텐츠|작가/i, "content"],
  [/호텔|관광|여행|mice|리조트|카지노/i, "hospitality"],
  [/승무원|항공|조종|공항|지상직|정비사/i, "aviation"],
  [/조리|셰프|요리|바리스타|카페|외식|식음|레스토랑|제과|제빵|식품/i, "food"],
  [/매장|점장|유통|리테일|이커머스|쇼핑몰|\bvmd\b|판매/i, "retail"],
  [/건축|인테리어|시공|현장|설비|\bmep\b/i, "architecture"],
  [/토목|도로|교량|터널|조경|측량|구조/i, "civil"],
  [/안전|보건관리|소방|산업위생/i, "safety"],
  [/환경|\besg\b|탄소|폐기물|수질|대기/i, "environment"],
  [/에너지|발전|전력|원자력|신재생|태양광|풍력|전기/i, "energy"],
  [/생산|제조|공장|라인|설비보전|보전/i, "production"],
  [/품질|\bq[ac]\b|신뢰성|검사/i, "quality"],
  [/공정|6시그마|\bie\b|산업공학/i, "process"],
  [/연구원|연구|과학|분석|실험|통계/i, "science"],
  [/큐레이터|학예|공연|전시|예술|문화|음악|미술/i, "culture_arts"],
  [/스포츠|트레이너|코치|체육|헬스|필라테스/i, "sports"],
  [/노무사|관세사|변리사|감정평가|통역|번역|부동산/i, "professional"],
];

/** Area (domain) a free-text job title most likely belongs to. */
export function guessDomain(position: string): DomainEntry | null {
  for (const [re, id] of DOMAIN_HINTS) if (re.test(position)) return DOMAIN_BY_ID.get(id) ?? null;
  return null;
}

export function resolveRole(position: string): Resolution {
  const q = normalizeTitle(position);
  const none: Resolution = { kind: "none", role: null, family: null, domain: null, suggestions: [], broad: false };
  if (!q) return none;
  const matches = searchRoles(position, 8);
  const top = matches[0];
  const broad = BROAD_TERMS[q];
  // A whole area ("사무직", "공무원", "연구원") — ask which job it's closest to, even if one role also uses the word.
  if (broad) {
    const roles = broad.roles.map((id) => ROLE_BY_ID.get(id)).filter((r): r is RoleEntry => Boolean(r));
    const fam = FAMILY_BY_ID.get(roles[0]?.family ?? "") ?? null;
    return { kind: "broad", role: null, family: fam, domain: fam ? DOMAIN_BY_ID.get(fam.domain)! : null, suggestions: roles, broad: true };
  }
  if (top && top.score >= 100) {
    return { kind: "role", role: top.role, family: top.family, domain: top.domain, suggestions: matches.slice(1, 6).map((m) => m.role), broad: false };
  }
  // A family or domain name ("간호", "재무", "공기업").
  const fam = FAMILIES.find((f) => normalizeTitle(f.name) === q || normalizeTitle(f.nameEn) === q);
  if (fam) {
    return { kind: "family", role: null, family: fam, domain: DOMAIN_BY_ID.get(fam.domain)!, suggestions: rolesInFamily(fam.id), broad: true };
  }
  const dom = DOMAINS.find((d) => normalizeTitle(d.name) === q || normalizeTitle(d.nameEn) === q || normalizeTitle(d.name).split("").join("") === q);
  if (dom) {
    const f = familiesInDomain(dom.id)[0];
    return { kind: "family", role: null, family: f, domain: dom, suggestions: rolesInDomain(dom.id).slice(0, 8), broad: true };
  }
  if (top && top.score >= 72) {
    return { kind: "role", role: top.role, family: top.family, domain: top.domain, suggestions: matches.slice(1, 6).map((m) => m.role), broad: false };
  }
  // Unknown title: infer the area from its words, keep the candidate's own title.
  const guessed = guessDomain(position);
  if (guessed) {
    const inDomain = matches.filter((m) => m.domain.id === guessed.id);
    const family = inDomain[0]?.family ?? familiesInDomain(guessed.id)[0];
    return { kind: "inferred", role: null, family, domain: guessed, suggestions: (inDomain.length ? inDomain.map((m) => m.role) : rolesInFamily(family.id)).slice(0, 6), broad: false };
  }
  if (top && top.score >= 40) {
    return { kind: "inferred", role: null, family: top.family, domain: top.domain, suggestions: matches.slice(0, 6).map((m) => m.role), broad: false };
  }
  return { ...none, suggestions: matches.slice(0, 6).map((m) => m.role) };
}

/* ─────────────────────────── role context ───────────────────────────── */

/** Everything the interviewer needs to know about the job being interviewed for. */
export interface RoleContext {
  /** Title as the candidate gave it (or the taxonomy title). */
  title: string;
  titleEn: string;
  /** Taxonomy role, when the job is one of ours. */
  role: RoleEntry | null;
  /**
   * The closest taxonomy role for a freely typed job — its questions are used
   * with lower priority than family/domain questions.
   */
  anchor: RoleEntry | null;
  family: FamilyEntry | null;
  domain: DomainEntry | null;
  archetype: Archetype;
  /** Practice profile for a job outside the taxonomy. */
  custom: CustomRole | null;
  kind: ResolveKind | "custom";
}

export function roleContextFor(cfg: { position: string; roleId?: string; customRole?: CustomRole }): RoleContext {
  const byId = getRole(cfg.roleId);
  if (byId) {
    const family = familyOf(byId);
    return { title: byId.ko, titleEn: byId.en, role: byId, anchor: byId, family, domain: domainOf(byId), archetype: family.archetype, custom: null, kind: "role" };
  }
  const res = resolveRole(cfg.position);
  if (cfg.customRole) {
    const domain = getDomain(cfg.customRole.domain) ?? res.domain;
    const families = domain ? familiesInDomain(domain.id) : [];
    const family = families.find((f) => normalizeTitle(f.name) === normalizeTitle(cfg.customRole!.family)) ?? (res.family && families.includes(res.family) ? res.family : families[0]) ?? null;
    const anchor = res.suggestions.find((r) => !family || r.family === family.id) ?? null;
    return { title: cfg.position, titleEn: cfg.position, role: null, anchor, family, domain: domain ?? null, archetype: cfg.customRole.archetype, custom: cfg.customRole, kind: "custom" };
  }
  if (res.kind === "role" && res.role) {
    return { title: cfg.position, titleEn: res.role.en, role: res.role, anchor: res.role, family: res.family, domain: res.domain, archetype: res.family!.archetype, custom: null, kind: "role" };
  }
  const anchor = res.suggestions.find((r) => !res.family || r.family === res.family.id) ?? null;
  return {
    title: cfg.position,
    titleEn: cfg.position,
    role: null,
    anchor: res.kind === "none" ? null : anchor,
    family: res.family,
    domain: res.domain,
    archetype: res.family?.archetype ?? "general",
    custom: null,
    kind: res.kind,
  };
}

/** The practitioner interviewer's department for this job ("재무회계팀", "간호부"). */
export function practitionerDept(ctx: RoleContext): string {
  return ctx.family?.dept ?? "현업부서";
}
