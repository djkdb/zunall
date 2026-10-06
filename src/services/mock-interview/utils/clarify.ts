/**
 * What the interviewer says when the candidate asks what a question means:
 * what the question is looking for and how to answer it, then the question again.
 */
import type { Language, Persona, QuestionType } from "../shared/schemas";

type Hint = Record<Language, string>;

const HINTS: Partial<Record<QuestionType, Hint>> & { default: Hint } = {
  opening: { ko: "지금까지 해 오신 일이나 경험, 그리고 이 직무에 지원하게 된 이유를 1분 정도로 편하게 말씀해 주시면 됩니다.", en: "Just tell me briefly what you've done so far and why you applied for this role — about a minute." },
  motivation: { ko: "이 일을 선택한 계기와, 그걸 위해 준비해 온 것을 말씀해 주시면 됩니다.", en: "Tell me what made you choose this work and what you've done to prepare for it." },
  company_understanding: { ko: "저희 회사에 대해 알고 계신 점과, 본인이 하게 될 일이 거기에 어떻게 연결되는지 말씀해 주시면 됩니다.", en: "Tell me what you know about us and how the work you'd do connects to it." },
  role_understanding: { ko: "이 직무가 실제로 어떤 일을 하고 무엇이 중요한지 어떻게 이해하고 계신지 여쭤본 겁니다.", en: "I'm asking how you understand what this job actually involves and what matters most in it." },
  behavioral: { ko: "실제로 겪은 일 하나를 골라서, 어떤 상황이었고 본인이 무엇을 했으며 결과가 어땠는지 순서대로 말씀해 주시면 됩니다.", en: "Pick one real situation and tell me what happened, what you did, and how it turned out." },
  experience: { ko: "실제로 해 본 경험 하나를 골라서, 어떤 상황이었고 본인이 무엇을 했으며 결과가 어땠는지 순서대로 말씀해 주시면 됩니다.", en: "Pick one real experience and tell me the situation, what you did, and the result." },
  situational: { ko: "정답을 보려는 게 아니라, 그런 상황이라면 무엇부터 하시고 왜 그렇게 판단하시는지를 보려는 질문입니다.", en: "There's no single right answer — I want to hear what you'd do first in that situation and why." },
  challenge: { ko: "앞서 말씀하신 판단이 다른 조건에서도 유지되는지 여쭤본 겁니다. 그 경우 어떻게 하실지 말씀해 주세요.", en: "I'm checking whether your judgment holds under a different condition — tell me what you'd do then." },
  role_specific: { ko: "이 업무를 할 때 어떤 기준으로 판단하시는지 보려는 질문입니다. 알고 계신 개념이나 해 보신 경험을 바탕으로 말씀해 주세요.", en: "I want to see how you'd judge this in the actual work — answer from what you know or have done." },
  technical: { ko: "이 기술을 어떤 기준으로 판단하고 쓰시는지 보려는 질문입니다. 아는 만큼 설명해 주시고, 모르는 부분은 모른다고 하셔도 괜찮습니다.", en: "I want to see how you reason about this technically — explain what you know; it's fine to say what you don't." },
  case: { ko: "실제 업무 사례라고 생각하시고, 무엇을 먼저 확인하고 어떤 순서로 풀어 가실지 말씀해 주시면 됩니다.", en: "Treat it as a real case — tell me what you'd check first and how you'd work through it." },
  numerical: { ko: "숫자를 어떻게 해석하시는지 보려는 질문입니다. 어떤 지표부터 확인하실지 차례로 말씀해 주세요.", en: "I want to see how you read the numbers — tell me which figures you'd check, in order." },
  analytical: { ko: "원인을 어떤 순서로 찾아 가시는지 보려는 질문입니다. 확인할 것들을 차례로 말씀해 주세요.", en: "I want to see how you'd track down the cause — walk me through what you'd check, in order." },
  industry: { ko: "이 분야의 흐름을 어떻게 보시는지, 본인의 생각과 그 이유를 말씀해 주시면 됩니다.", en: "Tell me how you see where this field is heading, and why." },
  leadership: { ko: "사람들을 이끌거나 설득했던 실제 경험을 하나 골라, 본인이 어떻게 했는지 말씀해 주시면 됩니다.", en: "Pick one time you led or influenced others and tell me how you did it." },
  communication: { ko: "상대에게 설명하거나 설득할 때 본인이 어떻게 하시는지 실제 예를 들어 말씀해 주시면 됩니다.", en: "Give me a real example of how you explain things to or persuade others." },
  ethics: { ko: "원칙과 현실이 부딪히는 상황에서 어떻게 판단하시는지, 그 이유와 함께 말씀해 주시면 됩니다.", en: "Tell me how you'd decide when principles and practicality clash, and why." },
  reflection: { ko: "스스로를 어떻게 돌아보시는지 보려는 질문입니다. 솔직한 생각과 그렇게 생각하시는 이유를 말씀해 주세요.", en: "I want to hear how you reflect on yourself — your honest view and why." },
  result: { ko: "그 일로 실제로 무엇이 달라졌는지, 가능하면 숫자나 구체적인 변화로 말씀해 주시면 됩니다.", en: "Tell me what actually changed as a result — numbers or concrete changes if you can." },
  deep_dive: { ko: "방금 말씀하신 내용에서 조금 더 구체적인 부분을 여쭤본 겁니다. 본인이 직접 한 일을 한두 가지만 더 말씀해 주세요.", en: "I'm asking for more detail on what you just said — tell me one or two more things you did yourself." },
  pt: { ko: "이 주제를 짧게 발표한다고 생각하시고, 핵심 주장과 근거 두세 가지를 말씀해 주시면 됩니다.", en: "Treat it as a short presentation — give your main point and two or three reasons." },
  debate: { ko: "어느 쪽이든 입장을 하나 정하시고, 그 이유를 말씀해 주시면 됩니다.", en: "Pick a side and tell me why." },
  default: { ko: "질문의 핵심에 대한 본인의 생각을 먼저 말씀하시고, 근거가 되는 경험을 덧붙여 주시면 됩니다.", en: "Give your view on the core of the question first, then a supporting example." },
};

export function clarifyLine(type: QuestionType, persona: Persona, lang: Language): string {
  const lead = lang === "ko" ? (persona === "strict" ? "다시 말씀드리겠습니다." : "네, 다시 설명드리겠습니다.") : persona === "strict" ? "Let me restate it." : "Sure, let me explain.";
  return `${lead} ${(HINTS[type] ?? HINTS.default)[lang]}`;
}
