/**
 * When the candidate swears at or insults the panel, or answers in banmal / chat-speak,
 * the chair ends the interview on the spot — what would happen in a real one.
 */
import type { FinalReport, Language } from "../shared/schemas";

export type ConductReason = "conduct" | "informal";

export function conductLine(lang: Language, reason: ConductReason): string {
  if (lang !== "ko") {
    return reason === "informal"
      ? "Answering the panel like that isn't appropriate for an interview. We'll end the interview here."
      : "That language is not acceptable in an interview. We'll end the interview here.";
  }
  return reason === "informal"
    ? "면접 자리에서 반말이나 채팅하듯 답하시는 건 적절하지 않습니다. 오늘 면접은 여기서 종료하겠습니다."
    : "지금 그 발언은 면접 자리에서 용납할 수 없습니다. 오늘 면접은 여기서 종료하겠습니다.";
}

export function conductLabel(reason: ConductReason): string {
  return reason === "informal" ? "면접 중단: 반말과 무성의한 답변" : "면접 중단: 부적절한 발언";
}

export function conductReport(lang: Language, reason: ConductReason): Pick<FinalReport, "headline" | "topFeedback" | "closingRemark"> {
  if (lang !== "ko") {
    return {
      headline: reason === "informal" ? "The panel chair ended the interview because the candidate answered too casually." : "The panel chair ended the interview because of inappropriate language.",
      topFeedback:
        reason === "informal"
          ? "In a real interview, answering in a casual or chat-style register ends your chances on the spot. Even a short answer should be polite."
          : "In a real interview, swearing or insults end your chances on the spot, whatever your answers. If a question is hard, say you're not sure or ask for a moment.",
      closingRemark: "An interview starts with mutual respect. Stay with it to the end next time.",
    };
  }
  return reason === "informal"
    ? {
        headline: "면접관에게 반말·채팅체로 답해 면접위원장이 면접을 중단했습니다.",
        topFeedback: "실제 면접에서 반말이나 'ㅇㅇ', '몰라' 같은 채팅체 답변은 그 자리에서 탈락 사유가 됩니다. 짧게 답하더라도 '네, ~입니다', '잘 모르겠습니다'처럼 존댓말로 말해 보세요.",
        closingRemark: "면접은 서로에 대한 예의에서 시작합니다. 다음 연습에서는 끝까지 함께해 주세요.",
      }
    : {
        headline: "면접 중 부적절한 발언으로 면접위원장이 면접을 중단했습니다.",
        topFeedback: "실제 면접에서 욕설이나 무례한 표현은 답변 내용과 상관없이 그 자리에서 탈락 사유가 됩니다. 답하기 어려운 질문에는 '잘 모르겠습니다'나 '잠시 생각해도 될까요?'라고 말해 보세요.",
        closingRemark: "면접은 서로에 대한 예의에서 시작합니다. 다음 연습에서는 끝까지 함께해 주세요.",
      };
}
