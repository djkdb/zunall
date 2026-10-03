/**
 * 등록한 활동을 추정 근거로 바꾼다 (순수 함수 — 테스트 가능).
 *
 * 올리브영 서포터즈를 하고 있는 사람에게 "마케팅 경험이 거의 없음"이라고 말하면
 * 그 순간 앱을 믿지 않는다. 사용자가 이미 알려준 활동은 역량 점수에 반영한다.
 *
 * 다만 정식 근거(사용자가 직접 남긴 프로젝트·수상 기록)와는 구분한다.
 * - 실제로 참여한 활동만 센다. 탈락한 인턴은 경험이 아니다.
 * - 가중치는 정식 근거보다 낮다.
 * - "검증 가능한 근거" 개수에는 넣지 않는다 (추정을 검증인 척하지 않는다).
 * - 이미 "활동에서 가져오기"로 근거가 된 활동은 다시 세지 않는다.
 */
import { detectSkills } from "./skill-detect";
import type { SkillEvidenceInput } from "@/services/score/skill";

export interface ActivityForEvidence {
  id: string;
  name: string;
  organizer: string | null;
  type: string;
  status: string;
}

/** 정식 근거 대비 추정 근거의 무게 */
export const INFERRED_WEIGHT_RATIO = 0.8;

/** 한 활동에서 추정하는 역량은 이 개수까지 */
const MAX_SKILLS_PER_ACTIVITY = 3;

/** 그 종류의 활동을 "실제로 했다"고 볼 수 있는 상태 */
const PARTICIPATED: Record<string, string[]> = {
  // 인턴·채용은 붙어서 일했을 때만. 지원·대기·탈락은 경험이 아니다.
  intern: ["active", "done", "won"],
  recruit: ["active", "done", "won"],
  // 공모전·해커톤은 결과물을 냈으면 떨어져도 만든 경험은 남는다
  contest: ["submitted", "waiting", "won", "lost", "done"],
  hackathon: ["submitted", "waiting", "won", "lost", "done", "active"],
};
const DEFAULT_PARTICIPATED = ["active", "submitted", "waiting", "won", "done"];

/** 활동 종류 → 근거 종류 (가중치가 다르다) */
function evidenceKindOf(type: string, status: string): string {
  if (status === "won") return "award";
  switch (type) {
    case "intern":
    case "recruit":
      return "work";
    case "contest":
    case "hackathon":
    case "project":
      return "project";
    case "opensource":
      return "github";
    case "education":
      return "education";
    case "supporters":
    case "external":
      return "activity";
    default:
      return "etc";
  }
}

/**
 * 이름에서 역량을 못 찾았을 때 쓰는, 활동 종류별 기본 역량.
 * 국내 기업 서포터즈·앰배서더는 사실상 브랜드 홍보 콘텐츠 활동이다.
 */
const TYPE_DEFAULT_SKILLS: Record<string, string[]> = {
  supporters: ["마케팅", "콘텐츠 제작"],
  external: ["협업", "커뮤니케이션"],
  contest: ["기획", "문제 해결"],
  hackathon: ["협업", "문제 해결"],
  project: ["협업"],
  opensource: ["협업"],
  intern: ["협업", "커뮤니케이션"],
  recruit: ["협업", "커뮤니케이션"],
};

/** 종류를 "대외활동"으로 골랐어도 이름이 서포터즈류면 그 성격으로 본다 */
const SUPPORTERS_NAME = /서포터즈|앰배서더|앰버서더|기자단|홍보대사/;

export function inferEvidenceFromActivities(
  activities: ActivityForEvidence[],
  /** 이미 정식 근거로 가져온 활동 id */
  alreadyEvidenced: Set<string>,
  /** 근거 종류별 기본 가중치 */
  kindWeights: Record<string, number>,
): SkillEvidenceInput[] {
  const out: SkillEvidenceInput[] = [];

  for (const activity of activities) {
    if (alreadyEvidenced.has(activity.id)) continue;
    const allowed = PARTICIPATED[activity.type] ?? DEFAULT_PARTICIPATED;
    if (!allowed.includes(activity.status)) continue;

    const detected = detectSkills(`${activity.name} ${activity.organizer ?? ""}`, MAX_SKILLS_PER_ACTIVITY);
    const byName = SUPPORTERS_NAME.test(activity.name) ? TYPE_DEFAULT_SKILLS.supporters : [];
    const byType = TYPE_DEFAULT_SKILLS[activity.type] ?? [];
    const skills = [...new Set([...detected, ...byName, ...byType])].slice(0, MAX_SKILLS_PER_ACTIVITY);
    if (skills.length === 0) continue;

    const kind = evidenceKindOf(activity.type, activity.status);
    out.push({
      id: `activity:${activity.id}`,
      kind,
      title: activity.name,
      skills,
      weight: Math.round((kindWeights[kind] ?? kindWeights.etc ?? 5) * INFERRED_WEIGHT_RATIO),
      inferred: true,
    });
  }
  return out;
}
