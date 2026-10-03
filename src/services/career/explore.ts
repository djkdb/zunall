// 진로 탐색 모드 (순수 함수)
//
// "아직 잘 모르겠어요. 출판이나 콘텐츠 쪽?"이라고 적은 사람에게, 키워드 하나로
// 고른 직무를 기준 삼아 "준비도 5/100, 자료 조사 -70"을 보여주면 판결처럼 읽힌다.
// 정하지 않은 사람에게는 점수 대신 후보를 나란히 놓고, 작게 먼저 해 볼 일을 준다.

import { ROLE_TEMPLATES, type RoleTemplate, type StudyField } from "@/lib/career-constants";
import { templateHits } from "@/services/career/templates";

/** 목표 문장이 아직 정하지 못했다는 뜻인지 */
const UNSURE = [
  /모르겠/,
  /잘\s*모르/,
  /미정/,
  /고민\s*(중|하고|이에요|입니다)/,
  /탐색/,
  /정하지\s*못/,
  /못\s*정/,
  /정하는\s*중/,
  /찾는\s*중/,
  /찾고\s*있/,
  /생각\s*중/,
  /관심\s*(만|정도)/,
  /\?/,
];

export function isExploringGoal(text: string | null | undefined): boolean {
  if (!text) return false;
  return UNSURE.some((re) => re.test(text));
}

/** 처음 해 보기 좋은, 2시간 안팎의 작은 실험 */
export interface FirstExperiment {
  title: string;
  minutes: number;
  why: string;
}

const EXPERIMENTS: Record<string, FirstExperiment> = {
  media: {
    title: "좋아하는 매체의 기사 1편을 골라 내 방식으로 다시 써 보기",
    minutes: 90,
    why: "쓰는 일이 즐거운지, 마감 있는 글이 맞는지 바로 알 수 있습니다.",
  },
  creator: {
    title: "60초짜리 짧은 영상 1편을 기획부터 편집까지 만들어 보기",
    minutes: 120,
    why: "만드는 과정 중 어느 단계가 재미있는지가 직무를 고르는 단서가 됩니다.",
  },
  marketing: {
    title: "좋아하는 브랜드 SNS의 한 달치 게시물을 보고 잘된 것 3개의 공통점 적기",
    minutes: 90,
    why: "숫자와 반응을 보는 일이 흥미로운지 확인할 수 있습니다.",
  },
  marketer_brand: {
    title: "인상 깊었던 광고 1편을 골라 '누구에게 무엇을 왜' 한 장으로 정리하기",
    minutes: 60,
    why: "광고를 소비자가 아니라 만든 사람 입장에서 보는 연습입니다.",
  },
  pm: {
    title: "자주 쓰는 앱 하나의 불편한 점 3개와 고치는 방법을 한 장으로 적기",
    minutes: 90,
    why: "문제를 찾고 우선순위를 정하는 일이 기획의 대부분입니다.",
  },
  designer: {
    title: "자주 쓰는 앱 화면 1개를 따라 그린 뒤 하나만 고쳐 보기",
    minutes: 120,
    why: "화면을 오래 들여다보는 일이 즐거운지 확인할 수 있습니다.",
  },
  teacher: {
    title: "아는 것 하나를 10분 분량으로 누군가에게 설명해 보기",
    minutes: 60,
    why: "가르치는 일의 보람과 피로를 둘 다 짧게 겪어 볼 수 있습니다.",
  },
  data: {
    title: "공공데이터 1개를 내려받아 엑셀로 질문 하나에 답해 보기",
    minutes: 120,
    why: "데이터에서 답을 찾는 과정이 맞는지 확인할 수 있습니다.",
  },
  public: {
    title: "관심 기관 1곳의 최근 보도자료 3건을 읽고 하는 일 정리하기",
    minutes: 60,
    why: "공고문보다 실제 업무를 먼저 보는 편이 판단이 빠릅니다.",
  },
};

export function firstExperimentFor(template: RoleTemplate): FirstExperiment {
  return (
    EXPERIMENTS[template.key] ?? {
      title: `${template.label} 채용공고 3개를 읽고 공통으로 요구하는 것 적어 보기`,
      minutes: 60,
      why: "실제 공고가 무엇을 요구하는지 보면 이 길이 나에게 맞는지 감이 옵니다.",
    }
  );
}

export interface ExploreCandidate {
  key: string;
  label: string;
  /** 이 직무가 가장 중요하게 보는 역량 (목표 수준 높은 순, 최대 3개) */
  keySkills: string[];
  /** 그 중 이미 근거가 있는 역량 */
  overlap: string[];
  experiment: FirstExperiment;
}

/**
 * 비교해 볼 후보 직무.
 * 목표 문장에 나온 단어로 걸리는 직무를 먼저, 그다음 전공 계열의 직무로 채운다.
 */
export function exploreCandidates(
  goalText: string,
  field: StudyField | null,
  skillScores: { name: string; score: number }[],
  max = 3,
): ExploreCandidate[] {
  const picked: RoleTemplate[] = [];
  const add = (t: RoleTemplate | undefined) => {
    if (t && t.key !== "general" && !picked.some((p) => p.key === t.key) && picked.length < max) picked.push(t);
  };

  for (const { template } of templateHits(goalText)) add(template);
  if (field) for (const t of ROLE_TEMPLATES.filter((t) => t.field === field)) add(t);
  // 계열에 직무가 하나뿐이면(인문·어학 등) 비교가 안 되니, 많이 가는 길로 채운다
  for (const key of ["pm", "marketing", "public"]) add(ROLE_TEMPLATES.find((t) => t.key === key));

  const evidenced = new Set(skillScores.filter((s) => s.score >= 20).map((s) => s.name));
  return picked.map((t) => {
    const keySkills = [...t.requirements]
      .sort((a, b) => b.target - a.target)
      .slice(0, 3)
      .map((r) => r.skill);
    return {
      key: t.key,
      label: t.label,
      keySkills,
      overlap: keySkills.filter((s) => evidenced.has(s)),
      experiment: firstExperimentFor(t),
    };
  });
}
