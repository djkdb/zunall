/**
 * Company / public-institution interview profiles, compiled from public
 * interview reviews and official recruiting pages (see each entry's sources).
 * Questions are paraphrased practice prompts — not official question banks,
 * and this app is not affiliated with any of these organizations.
 */
import { z } from "zod";
import { COMPANY_DATA } from "./data/companies";
import { loadData } from "./dataLoader";

export const COMPANY_CATEGORIES = ["대기업", "IT·플랫폼", "금융·통신·식품", "공기업", "공공기관", "의료기관"] as const;
export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number];

export const COMPANY_Q_CATEGORIES = ["인성", "직무", "경험", "상황", "기업이해", "PT·토론", "기술"] as const;
export type CompanyQuestionCategory = (typeof COMPANY_Q_CATEGORIES)[number];

export const CompanyQuestionSchema = z.object({
  text: z.string().trim().min(4).max(140),
  category: z.enum(COMPANY_Q_CATEGORIES),
  track: z.string().trim().min(1).max(20),
  basis: z.enum(["후기", "공식자료"]),
});
export type CompanyQuestion = z.infer<typeof CompanyQuestionSchema>;

export const CompanySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(1).max(40),
  shortName: z.string().max(20).optional(),
  category: z.enum(COMPANY_CATEGORIES),
  industry: z.string().max(60),
  talent: z.array(z.string().max(100)).max(12),
  process: z.array(z.string().max(120)).max(8),
  style: z.string().max(400),
  tips: z.array(z.string().max(200)).max(8),
  /** The question bank is loaded on demand — see loadCompanyQuestions(). */
  questionCount: z.number().int().min(5).max(150),
  reportedCount: z.number().int().min(0),
  tracks: z.array(z.string().max(20)).max(20),
  sources: z.array(z.object({ title: z.string().max(200), url: z.string().url() })).min(1).max(20),
});
export type Company = z.infer<typeof CompanySchema>;

/** Validated at load; malformed entries are dropped rather than breaking the app. */
export const COMPANIES: Company[] = COMPANY_DATA.flatMap((c) => {
  const r = CompanySchema.safeParse(c);
  return r.success ? [r.data] : [];
});

/** Number of raw entries, so tests can catch entries silently dropped by validation. */
export const COMPANY_DATA_COUNT = COMPANY_DATA.length;

const BY_ID = new Map(COMPANIES.map((c) => [c.id, c]));

export function getCompany(id: string | null | undefined): Company | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** "Passionate: 끊임없이 도전하는 열정人" → "Passionate", "핵심가치: 안전(우선)" → "안전" */
export function talentKeyword(t: string): string {
  let s = t.replace(/^(?:핵심가치|인재상|가치)\s*[:：]\s*/, "");
  s = s.split(/\s*[:：(（]/)[0].trim();
  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
}

export function companyTracks(c: Company): string[] {
  return ["공통", ...c.tracks];
}

/**
 * A company's question bank (30–60 per organization is typical). Loaded on demand and
 * validated; the AI prompt only ever receives a filtered handful of them.
 */
export async function loadCompanyQuestions(id: string): Promise<CompanyQuestion[]> {
  if (!getCompany(id)) return [];
  const data = await loadData<{ questions?: unknown }>(`companies/${id}.json`).catch(() => ({ questions: [] }));
  const parsed = z.array(CompanyQuestionSchema).safeParse(data.questions);
  return parsed.success ? parsed.data : [];
}

/** Questions for a track: that track's questions plus the common ones. */
export function questionsForTrack(questions: CompanyQuestion[], track: string | null | undefined): CompanyQuestion[] {
  const t = track && track !== "공통" ? track : null;
  return questions.filter((q) => q.track === "공통" || !t || q.track === t);
}

/** Best-guess track from the position name (e.g. "백엔드 개발자" → "개발"). */
export function guessTrack(c: Company, position: string): string {
  const p = position.toLowerCase();
  const tracks = companyTracks(c).slice(1);
  const rules: [RegExp, RegExp][] = [
    [/간호|nurse/, /간호/],
    [/승무원|객실/, /객실|승무/],
    [/정비/, /정비/],
    [/전기/, /전기/],
    [/기계/, /기계/],
    [/토목|건축|시공|건설/, /토목|건축|시공|건설/],
    [/회계|재무|세무|인사|총무|경영|사무|행정/, /사무|행정|경영|일반/],
    [/금융|은행|pb|rm|여신/, /금융|개인|기업|일반/],
    [/품질|생산|공정|설비/, /품질|생산|공정|설비|제조/],
    [/개발|developer|engineer|엔지니어|프론트|백엔드|front|back/, /개발|ICT|IT|전산|디지털/],
    [/ai|데이터|data|ml/, /데이터|AI|개발|ICT|디지털/],
    [/기획|pm|product/, /기획|PM/],
    [/디자인|design|ux|ui/, /디자인/],
    [/마케|marketing|영업|sales/, /마케팅|영업/],
    [/연구|r&d|research/, /연구/],
  ];
  for (const [pos, tr] of rules) {
    if (pos.test(p)) {
      const hit = tracks.find((t) => tr.test(t));
      if (hit) return hit;
    }
  }
  return tracks.find((t) => p.includes(t.toLowerCase())) ?? "공통";
}
