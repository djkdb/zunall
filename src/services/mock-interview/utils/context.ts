/**
 * Builds the bounded conversation context sent to the AI.
 * Only the most recent turns go in full; older questions are sent as a
 * plain list so the model can avoid repeats without resending everything.
 */
import { LIMITS, type AIConfig, type CurrentTurn, type InterviewContext } from "../shared/schemas";
import type { Interview, InterviewQuestion } from "../types";
import { hasDocuments } from "../shared/documents";

const HISTORY_WINDOW = 4;
const ANSWER_CHARS_IN_HISTORY = 1500;

export function toAIConfig(i: Interview): AIConfig {
  const { position, experience, interviewType, difficulty, questionLimit, jobDescription, persona, language, companyId, companyTrack, roleId, customRole, documents } = i.config;
  return { position, experience, interviewType, difficulty, questionLimit, jobDescription, persona, language, companyId, companyTrack, roleId, customRole, ...(hasDocuments(documents) ? { documents } : {}) };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildContext(i: Interview): InterviewContext {
  const answered = i.questions.filter((q) => q.answer);
  return {
    config: toAIConfig(i),
    progress: {
      asked: i.questions.filter((q) => !q.isFollowUp).length,
      total: i.config.questionLimit,
      followUps: i.questions.filter((q) => q.isFollowUp).length,
    },
    history: answered.slice(-Math.min(HISTORY_WINDOW, LIMITS.historyTurns)).map((q) => ({
      question: clip(q.text, LIMITS.question),
      type: q.type,
      isFollowUp: q.isFollowUp,
      answer: clip(q.answer ?? "", ANSWER_CHARS_IN_HISTORY),
    })),
    askedQuestions: i.questions.slice(-LIMITS.askedQuestions).map((q) => clip(q.text, LIMITS.question)),
    usedTypes: i.questions.slice(-LIMITS.askedQuestions).map((q) => q.type),
  };
}

export function toCurrentTurn(q: InterviewQuestion, answer: string): CurrentTurn {
  return {
    question: clip(q.text, LIMITS.question),
    type: q.type,
    isFollowUp: q.isFollowUp,
    answer: clip(answer, LIMITS.answer),
  };
}
