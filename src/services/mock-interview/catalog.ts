/**
 * 화면에 넘길 직무·기업 목록과, Cavero 의 커리어 목표 → 면접 직무 연결.
 * (질문 은행 본문은 여기 없다 — 정적 파일로 필요할 때만 읽는다)
 */
import { DOMAINS, FAMILIES, ROLES, getRole, resolveRole, roleContextFor } from "./shared/roles";
import type { Archetype } from "./shared/schemas";
import { COMPANIES, companyTracks, getCompany, guessTrack, type Company } from "./shared/companies";

/** Cavero 직무 템플릿 키 → 면접 직무 id. 딱 맞는 직무가 없으면(작가·음악 등) 비워 두고 이름으로 면접한다. */
export const ROLE_FOR_TEMPLATE: Record<string, string> = {
  ai_engineer: "ai_engineer",
  frontend: "frontend",
  backend: "backend",
  data: "data_analyst",
  pm: "service_planner",
  marketing: "brand_marketer",
  designer: "product_designer",
  marketer_brand: "ad_planner",
  consultant: "management_consultant",
  finance: "finance_manager",
  hr: "hr_planner",
  public: "public_institution_staff",
  media: "pr_specialist",
  teacher: "secondary_teacher",
  researcher: "research_scientist",
  healthcare: "nurse",
  engineer_mech: "mechanical_designer",
  creator: "video_producer",
  social_impact: "social_worker",
  trade: "trade_admin",
  arts_manager: "performance_planner",
  sports_coach: "fitness_trainer",
  sports_industry: "sports_marketer",
  curator: "curator",
  editor: "editor",
  translator: "translator",
  counselor: "counselor",
};

export interface RoleOption {
  id: string;
  ko: string;
  family: string;
  domain: string;
  /** 검색용 (이름·영문·별칭) */
  keys: string;
}

export interface CompanyOption {
  id: string;
  name: string;
  category: string;
  industry: string;
  tracks: string[];
  questionCount: number;
}

export function roleOptions(): RoleOption[] {
  const famById = new Map(FAMILIES.map((f) => [f.id, f]));
  const domById = new Map(DOMAINS.map((d) => [d.id, d]));
  return ROLES.map((r) => {
    const fam = famById.get(r.family);
    const dom = fam ? domById.get(fam.domain) : undefined;
    return {
      id: r.id,
      ko: r.ko,
      family: fam?.name ?? "",
      domain: dom?.name ?? "",
      keys: [r.ko, r.en, ...r.aliases.slice(0, 8), fam?.name ?? "", dom?.name ?? ""].join(" ").toLowerCase(),
    };
  });
}

export function companyOptions(): CompanyOption[] {
  return COMPANIES.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    industry: c.industry,
    tracks: companyTracks(c),
    questionCount: c.questionCount,
  }));
}

export interface RoleSuggestion {
  roleId: string | null;
  position: string;
}

/** 커리어 목표(직무 템플릿 / 목표 이름)로 면접 직무를 미리 골라 둔다 */
export function suggestRole(roleKey: string | null | undefined, goalName: string | null | undefined): RoleSuggestion | null {
  const mapped = roleKey ? ROLE_FOR_TEMPLATE[roleKey] : undefined;
  const byKey = mapped ? getRole(mapped) : null;
  if (byKey) return { roleId: byKey.id, position: byKey.ko };
  const name = goalName?.trim();
  if (!name) return null;
  const r = resolveRole(name);
  if (r.kind === "role" && r.role) return { roleId: r.role.id, position: r.role.ko };
  return { roleId: null, position: name.slice(0, 80) };
}

/**
 * 기업 질문 은행에서 "공통"을 고르면 모든 직군 질문(개발 직군의 알고리즘 질문 포함)이 섞인다.
 * 그래서 기획자·간호사에게 "퀵 정렬의 시간복잡도"를 묻는 일이 생겼다.
 * 직군을 못 고르면 목록에 없는 이 이름을 넘겨 공통 질문만 쓰게 한다 (questionsForTrack 은 공통 + 그 직군만 남긴다).
 */
export const COMMON_ONLY_TRACK = "공통 질문만";

/** 면접 유형(archetype)별로 기업 직군 이름에서 찾을 말 */
const TRACK_HINTS: Partial<Record<Archetype, RegExp>> = {
  tech_dev: /개발|IT|ICT|디지털|전산|정보통신|인프라|네트워크/,
  data_analytic: /데이터|AI|개발|IT|디지털|리서치/,
  product_planning: /기획|PM|IT기획|사업/,
  strategy_business: /기획|사업|경영지원|사무|일반/,
  finance_accounting: /재무|경영지원|사무|금융일반|일반/,
  finance_markets: /금융|자산운용|IB|WM|기업금융|개인금융|리서치/,
  hr_people: /경영지원|사무|일반|행정/,
  admin_support: /사무|경영지원|일반|행정/,
  legal_compliance: /사무|경영지원|심사|일반/,
  marketing_growth: /마케팅|영업·마케팅|사업/,
  sales_customer: /영업|일반·영업|영업관리/,
  commerce_md: /MD|상품|매장|영업/,
  supply_ops: /구매|물류|SCM|풀필먼트|생산/,
  service_hospitality: /객실|호텔|리조트|서비스|매장/,
  design_creative: /디자인/,
  media_content: /마케팅|콘텐츠|사업/,
  engineering_design: /설계|기계|전기|연구개발/,
  manufacturing_quality: /품질|생산|설비|공정/,
  field_construction: /시공|토목|건축|건설|설비/,
  safety_environment: /안전|환경/,
  research_science: /연구/,
  clinical_care: /간호|임상|보건/,
  public_service: /행정|사무|일반직/,
};

/** 지원 직무에 맞는 기업 직군. 사용자가 고른 값이 있으면 그것, 없으면 직무로 추정 */
export function trackFor(company: Company, position: string, roleId?: string | null): string {
  const tracks = company.tracks;
  if (!tracks.length) return "공통";
  const byName = guessTrack(company, position);
  if (byName !== "공통") return byName;
  const hint = TRACK_HINTS[roleContextFor({ position, roleId: roleId ?? undefined }).archetype];
  return (hint && tracks.find((t) => hint.test(t))) || COMMON_ONLY_TRACK;
}

/** 회사·직군이 실제 목록에 있는 값인지 확인하고 맞춘다 (브라우저가 보낸 값을 그대로 믿지 않는다) */
export function resolveCompany(companyId: string | null | undefined, track: string | null | undefined, position: string, roleId?: string | null) {
  const company = getCompany(companyId);
  if (!company) return null;
  if (track === "공통") return { company, track: COMMON_ONLY_TRACK };
  const chosen = track && company.tracks.includes(track) ? track : trackFor(company, position, roleId);
  return { company, track: chosen };
}
