import type { AnswerQuality, Language, Persona } from "../shared/schemas";

type Pool = Record<Language, string[]>;

const REACTIONS: Record<AnswerQuality, Pool> = {
  strong: {
    ko: ["네, 어떻게 하셨는지 잘 알겠습니다.", "네, 그렇게 판단하신 이유가 이해됩니다.", "네, 구체적으로 말씀해 주셔서 감사합니다.", "네, 근거까지 잘 들었습니다.", "알겠습니다. 순서대로 말씀해 주셔서 따라가기 쉬웠습니다."],
    en: ["Thanks, that was clear and specific.", "That was easy to follow.", "Got it. I can see how you decided.", "Thanks, the reasoning came through.", "Understood. Walking through it in order helped."],
  },
  adequate: {
    ko: ["네, 잘 들었습니다.", "네, 감사합니다.", "네, 좋습니다."],
    en: ["Okay, thank you.", "Understood, I get the general direction.", "Alright, thanks."],
  },
  vague: {
    ko: ["조금 추상적으로 들리는 부분이 있네요.", "전체적인 방향은 이해했지만, 조금 더 구체적이면 좋겠습니다."],
    en: ["That sounds a bit abstract.", "I get the direction, but I'd like more specifics."],
  },
  insufficient: {
    ko: ["답변이 조금 짧았던 것 같습니다.", "네, 조금 더 자세히 들을 수 있으면 좋겠네요.", "알겠습니다. 근거가 조금 더 있었으면 좋겠습니다.", "네. 다음에는 예를 하나 들어 주시면 좋겠습니다."],
    en: ["That answer was a little short.", "Okay. I'd have liked a bit more detail.", "Understood. A bit more support would help.", "Okay. An example next time would help."],
  },
  off_topic: {
    ko: ["질문의 의도와 조금 다른 방향의 답변인 것 같습니다."],
    en: ["That seems a bit off from what I asked."],
  },
};

const PERSONA_PREFIX: Record<Persona, Record<Language, string>> = {
  professional: { ko: "", en: "" },
  friendly: { ko: "좋네요. ", en: "Nice. " },
  strict: { ko: "", en: "" },
  technical: { ko: "", en: "" },
};

export function pick<T>(xs: T[], seed: number): T {
  return xs[Math.abs(seed) % xs.length];
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function reactionFor(quality: AnswerQuality, persona: Persona, lang: Language, seed: number): string {
  const base = pick(REACTIONS[quality][lang], seed);
  if (persona === "friendly" && (quality === "strong" || quality === "adequate")) return PERSONA_PREFIX.friendly[lang] + base;
  if (persona === "strict" && quality === "strong") return lang === "ko" ? "네." : "Noted.";
  return base;
}

export const CLOSING: Record<Persona, Record<Language, string>> = {
  professional: { ko: "오늘 면접은 여기까지입니다. 수고하셨습니다.", en: "That concludes our interview. Thank you for your time." },
  friendly: { ko: "오늘 이야기 정말 즐거웠어요. 수고 많으셨습니다!", en: "I really enjoyed our conversation today. Great work!" },
  strict: { ko: "면접을 마치겠습니다. 피드백을 꼭 확인해주세요.", en: "We're done. Review the feedback carefully." },
  technical: { ko: "좋은 기술 대화였습니다. 여기서 마치겠습니다.", en: "Good technical discussion. Let's wrap up here." },
};
