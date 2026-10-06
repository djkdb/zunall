/**
 * Question templates for MOCK MODE. The mock interviewer picks from these
 * based on position, interview type, used types and earlier answers — it
 * never simply picks a random fixed question.
 */
import type { InterviewType, Language, QuestionType } from "../shared/schemas";

export type Localized = Record<Language, string>;
interface BankItem extends Localized {
  tags?: InterviewType[];
}

export type RoleFamily = "frontend" | "backend" | "ai" | "pm" | "designer" | "marketing" | "general";

export function roleFamily(position: string): RoleFamily {
  const p = position.toLowerCase();
  if (/front|프론트|web|웹|react|ui ?dev/.test(p)) return "frontend";
  if (/back|백엔드|server|서버|infra|devops|platform/.test(p)) return "backend";
  if (/\bai\b|ml|machine|머신|인공지능|data scien|데이터 ?사이언|llm/.test(p)) return "ai";
  if (/product|pm|po\b|기획|프로덕트/.test(p)) return "pm";
  if (/design|디자인|ux|ui\b/.test(p)) return "designer";
  if (/market|마케팅|마케터|growth|그로스|brand|브랜드/.test(p)) return "marketing";
  return "general";
}

export const TYPE_PLAN: Record<InterviewType, QuestionType[]> = {
  hr: ["opening", "motivation", "reflection", "challenge", "deep_dive", "result"],
  technical: ["opening", "technical", "deep_dive", "technical", "challenge", "reflection", "technical", "result"],
  project: ["opening", "deep_dive", "technical", "result", "challenge", "reflection"],
  behavioral: ["opening", "deep_dive", "challenge", "result", "reflection", "deep_dive"],
  mixed: ["opening", "motivation", "deep_dive", "technical", "challenge", "result", "reflection"],
};

export const OPENING: BankItem[] = [
  { ko: "먼저 1분 동안 간단하게 자기소개 부탁드립니다.", en: "First, please introduce yourself in about a minute.", tags: ["mixed", "hr"] },
  { ko: "최근에 작업한 프로젝트 하나를 소개해 주시겠어요?", en: "Tell me about a project you worked on recently.", tags: ["technical"] },
  { ko: "가장 어려웠던 프로젝트 하나를 설명해주세요.", en: "Walk me through the most challenging project you've worked on.", tags: ["project", "behavioral"] },
  { ko: "{position} 직무에 지원하신 이유를 말씀해주세요.", en: "What made you apply for this {position} role?", tags: ["hr"] },
  { ko: "우리 회사에 지원하신 동기를 말씀해 주세요.", en: "Why do you want to join our company?", tags: ["hr", "mixed"] },
];

export const GENERAL: Record<"motivation" | "deep_dive" | "challenge" | "reflection" | "result", BankItem[]> = {
  motivation: [
    { ko: "{position} 직무에 지원하신 이유를 말씀해주세요.", en: "What made you apply for this {position} role?" },
    { ko: "우리 회사에 지원하신 동기를 말씀해 주세요.", en: "Why do you want to join our company?" },
    { ko: "입사 후 가장 먼저 해 보고 싶은 일은 무엇인가요?", en: "What would you most like to work on first after joining?" },
  ],
  deep_dive: [
    { ko: "앞서 말씀하신 {topic} 경험에서 가장 중요했던 결정은 무엇이었나요?", en: "Going back to {topic} — what was the most important decision you made there?" },
    { ko: "최근 업무에서 가장 해결하기 어려웠던 문제를 하나 설명해주세요.", en: "Describe the hardest problem you had to solve in your recent work." },
    { ko: "팀과 의견이 달랐던 경험이 있다면 어떻게 풀어가셨나요?", en: "Tell me about a time you disagreed with your team. How did you handle it?", tags: ["behavioral", "hr"] },
    { ko: "스스로 문제를 발견하고 먼저 개선을 제안했던 경험이 있나요?", en: "Tell me about a time you spotted a problem and proposed a fix on your own initiative.", tags: ["behavioral", "project"] },
  ],
  challenge: [
    { ko: "만약 같은 일을 일정 절반으로 끝내야 했다면 무엇을 포기하시겠어요?", en: "If you had to deliver the same work in half the time, what would you cut?" },
    { ko: "팀원이 당신의 방식에 강하게 반대한다면 어떻게 설득하시겠어요?", en: "If a teammate strongly opposed your approach, how would you convince them?" },
    { ko: "요구사항이 출시 직전에 크게 바뀐다면 어떻게 대응하시겠어요?", en: "If the requirements changed drastically right before launch, how would you respond?" },
    { ko: "우선순위가 충돌하는 두 요청을 동시에 받는다면 어떻게 결정하시겠어요?", en: "If you received two conflicting high-priority requests at once, how would you decide?" },
    { ko: "상사가 부당하다고 느껴지는 지시를 한다면 어떻게 하시겠어요?", en: "What would you do if your manager gave an instruction you felt was unfair?", tags: ["hr", "mixed"] },
  ],
  reflection: [
    { ko: "그 경험을 다시 한다면 무엇을 다르게 하시겠어요?", en: "If you could do that again, what would you do differently?" },
    { ko: "최근 1년 동안 가장 크게 성장했다고 느낀 부분은 무엇인가요?", en: "Where do you feel you've grown the most in the past year?" },
    { ko: "실패했던 경험 하나와 그 경험에서 배운 점을 말씀해주세요.", en: "Tell me about a failure and what you learned from it.", tags: ["hr", "behavioral"] },
    { ko: "본인의 가장 큰 약점은 무엇이고, 어떻게 보완하고 있나요?", en: "What is your biggest weakness, and how are you working on it?", tags: ["hr"] },
    { ko: "입사 후 5년 뒤 본인의 모습은 어떨 것 같나요?", en: "Where do you see yourself five years after joining?", tags: ["hr", "mixed"] },
  ],
  result: [
    { ko: "지금까지 만든 성과 중 수치로 설명할 수 있는 것이 있나요?", en: "Which of your results can you describe with numbers?" },
    { ko: "본인의 기여로 가장 크게 달라진 지표나 결과는 무엇이었나요?", en: "What metric or outcome changed the most because of your contribution?" },
    { ko: "그 프로젝트가 성공했는지 어떻게 판단하셨나요?", en: "How did you decide whether that project was a success?" },
  ],
};

export const TECHNICAL: Record<RoleFamily, Localized[]> = {
  frontend: [
    { ko: "렌더링 성능 문제를 진단할 때 어떤 순서로 접근하시나요?", en: "How do you approach diagnosing a rendering performance problem?" },
    { ko: "상태 관리 방식을 선택할 때 어떤 기준으로 결정하시나요?", en: "How do you decide on a state management approach?" },
    { ko: "초기 로딩 속도를 개선했던 방법을 설명해주세요.", en: "Explain how you've improved initial load performance." },
    { ko: "컴포넌트 재사용성과 단순함이 충돌할 때 어떻게 판단하시나요?", en: "When reusability and simplicity conflict in components, how do you decide?" },
  ],
  backend: [
    { ko: "트래픽이 10배로 늘어난다면 어디부터 병목을 확인하시겠어요?", en: "If traffic grew 10x, where would you look for bottlenecks first?" },
    { ko: "캐시를 도입할 때 데이터 정합성은 어떻게 보장하시나요?", en: "When introducing a cache, how do you keep data consistent?" },
    { ko: "장애가 발생했을 때 원인을 추적하는 본인만의 순서가 있나요?", en: "When an incident happens, what's your process for tracing the root cause?" },
    { ko: "API 설계에서 가장 중요하게 생각하는 원칙은 무엇인가요?", en: "What principle matters most to you in API design?" },
  ],
  ai: [
    { ko: "모델 성능이 기대보다 낮을 때 가장 먼저 무엇을 확인하시나요?", en: "When a model underperforms, what do you check first?" },
    { ko: "LLM 기능의 품질을 어떻게 평가하고 개선하시나요?", en: "How do you evaluate and improve the quality of an LLM feature?" },
    { ko: "학습 데이터의 품질 문제를 발견했던 경험이 있나요?", en: "Have you ever discovered a data quality problem in training data?" },
    { ko: "지연 시간과 정확도 사이에서 어떻게 트레이드오프를 결정하시나요?", en: "How do you decide the trade-off between latency and accuracy?" },
  ],
  pm: [
    { ko: "여러 기능 요청 중 우선순위는 어떤 기준으로 정하시나요?", en: "How do you prioritize among competing feature requests?" },
    { ko: "출시한 기능이 성공했는지 어떤 지표로 판단하셨나요?", en: "Which metrics told you whether a launched feature succeeded?" },
    { ko: "데이터와 사용자 인터뷰 결과가 다를 때 어떻게 판단하시나요?", en: "When data and user interviews disagree, how do you decide?" },
  ],
  designer: [
    { ko: "디자인 결정을 개발자나 PM에게 어떻게 설득하시나요?", en: "How do you convince engineers or PMs of a design decision?" },
    { ko: "사용성 문제를 발견하고 개선했던 과정을 설명해주세요.", en: "Walk me through finding and fixing a usability problem." },
    { ko: "디자인 시스템과 개별 화면의 요구가 충돌하면 어떻게 하시나요?", en: "What do you do when the design system conflicts with a screen's needs?" },
  ],
  marketing: [
    { ko: "캠페인 성과가 기대보다 낮을 때 원인을 어떻게 분석하시나요?", en: "When a campaign underperforms, how do you analyze why?" },
    { ko: "제한된 예산으로 채널을 선택할 때 기준은 무엇인가요?", en: "With a limited budget, how do you choose channels?" },
    { ko: "A/B 테스트를 설계할 때 가장 신경 쓰는 부분은 무엇인가요?", en: "What do you pay most attention to when designing an A/B test?" },
  ],
  general: [
    { ko: "{position} 업무에서 가장 중요한 역량은 무엇이라고 생각하나요?", en: "What do you think is the most important skill for a {position}?" },
    { ko: "업무 품질을 높이기 위해 본인이 만든 방법이나 도구가 있나요?", en: "Have you built a method or tool to raise the quality of your work?" },
    { ko: "처음 접하는 문제를 빠르게 파악하는 본인만의 방법이 있나요?", en: "How do you get up to speed quickly on an unfamiliar problem?" },
  ],
};

/** Questions that reference the job description's own keywords. */
export const JD_TECHNICAL: Localized[] = [
  { ko: "채용공고에 {jd:이/가} 있는데, 실제로 사용해 본 경험을 말씀해 주세요.", en: "The job description mentions {jd}. Tell me about your hands-on experience with it." },
  { ko: "{jd:을/를} 사용하면서 겪었던 가장 까다로운 문제는 무엇이었나요?", en: "What was the trickiest problem you faced while working with {jd}?" },
];
