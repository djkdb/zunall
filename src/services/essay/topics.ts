/**
 * 자소서 문항 유형 분류 (순수 함수, 규칙 기반).
 *
 * 기업·공고가 달라도 문항은 크게 열 갈래로 반복된다.
 * 유형을 붙여두면 "예전에 비슷한 문항에 뭐라고 썼더라"를 바로 찾아줄 수 있다.
 */

export const ESSAY_TOPICS = {
  motivation: "지원 동기",
  growth: "성장 과정",
  strength: "강점 · 역량",
  weakness: "단점 · 보완점",
  teamwork: "협업 · 갈등",
  challenge: "도전 · 실패",
  achievement: "성과 · 문제 해결",
  plan: "입사 후 포부",
  creativity: "창의 · 아이디어",
  etc: "기타",
} as const;
export type EssayTopic = keyof typeof ESSAY_TOPICS;

/** 유형별 신호 키워드. 앞쪽일수록 강한 신호 */
const RULES: Array<{ topic: EssayTopic; keywords: string[]; weight?: number }> = [
  {
    topic: "motivation",
    keywords: [
      "지원 동기", "지원동기", "지원한 이유", "왜 우리", "왜 이 회사", "지원하게 된",
      "관심을 갖게", "선택한 이유", "매력", "why us",
    ],
  },
  {
    topic: "plan",
    keywords: [
      "입사 후", "입사후", "포부", "이루고 싶은", "목표", "기여", "커리어 계획",
      "10년 후", "5년 후", "앞으로의",
    ],
  },
  {
    topic: "growth",
    keywords: ["성장 과정", "성장과정", "성장 배경", "자라온", "가치관", "영향을 준", "나를 만든"],
  },
  {
    topic: "weakness",
    keywords: ["단점", "부족한 점", "보완", "아쉬웠던", "약점", "개선이 필요"],
  },
  {
    topic: "strength",
    keywords: ["강점", "장점", "차별화", "경쟁력", "잘하는", "역량", "본인의 능력", "적합한 이유"],
  },
  {
    topic: "teamwork",
    keywords: [
      "협업", "팀워크", "team", "갈등", "의견 차이", "설득", "함께", "소통",
      "구성원", "조직", "팀 프로젝트",
    ],
  },
  {
    topic: "challenge",
    keywords: ["도전", "실패", "좌절", "어려움", "극복", "힘들었", "포기", "역경", "시련"],
  },
  {
    topic: "achievement",
    keywords: ["성과", "문제를 해결", "문제 해결", "개선한", "성공", "결과를 만든", "기여한 경험", "임팩트"],
  },
  {
    topic: "creativity",
    keywords: ["창의", "아이디어", "새로운 시도", "기존과 다른", "혁신", "제안"],
  },
];

export interface Classified {
  topic: EssayTopic;
  /** 어떤 말 때문에 그렇게 봤는지 (화면에 근거로 보여준다) */
  matched: string[];
}

/** 문항 텍스트에서 유형을 고른다. 신호가 없으면 기타. */
export function classifyQuestion(question: string): Classified {
  const text = question.toLowerCase().replace(/\s+/g, " ");
  if (!text.trim()) return { topic: "etc", matched: [] };

  let best: { topic: EssayTopic; score: number; matched: string[] } | null = null;

  for (const rule of RULES) {
    const matched = rule.keywords.filter((word) => text.includes(word.toLowerCase()));
    if (matched.length === 0) continue;
    // 긴 키워드가 걸리면 더 확실한 신호로 본다
    const score = matched.reduce((sum, word) => sum + word.length, 0) + matched.length;
    if (!best || score > best.score) best = { topic: rule.topic, score, matched };
  }

  return best ? { topic: best.topic, matched: best.matched } : { topic: "etc", matched: [] };
}

/** 저장된 값이 아는 유형일 때만 쓴다 */
export function parseTopic(value: string | null | undefined): EssayTopic | null {
  return value && value in ESSAY_TOPICS ? (value as EssayTopic) : null;
}

/** 문항의 유형 — 사용자가 직접 고른 값이 있으면 그것을 우선한다 */
export function topicOf(question: { question: string; topic?: string | null }): EssayTopic {
  return parseTopic(question.topic) ?? classifyQuestion(question.question).topic;
}
