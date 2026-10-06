/**
 * 화면에 넘길 직무·기업 목록과, Cavero 의 커리어 목표 → 면접 직무 연결.
 * (질문 은행 본문은 여기 없다 — 정적 파일로 필요할 때만 읽는다)
 */
import { DOMAINS, FAMILIES, ROLES, getRole, resolveRole } from "./shared/roles";
import { COMPANIES, companyTracks, getCompany, guessTrack } from "./shared/companies";

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

/** 회사·직군이 실제 목록에 있는 값인지 확인하고 맞춘다 (브라우저가 보낸 값을 그대로 믿지 않는다) */
export function resolveCompany(companyId: string | null | undefined, track: string | null | undefined, position: string) {
  const company = getCompany(companyId);
  if (!company) return null;
  const tracks = companyTracks(company);
  const chosen = track && tracks.includes(track) ? track : guessTrack(company, position);
  return { company, track: chosen };
}
