/**
 * Interview pacing rules.
 *
 * The question limit counts MAIN questions: a 10-question interview asks 10 main
 * questions, plus follow-ups where an answer calls for one. Follow-ups are capped
 * (per thread and in total) so the interview never balloons past its length.
 */
import type { Interview, InterviewQuestion } from "../types";

const MAX_DEPTH = { easy: 1, normal: 2, hard: 2 } as const;
/** Follow-ups allowed across the whole interview, as a share of the main questions. */
const FOLLOW_UP_SHARE = { easy: 0.4, normal: 0.6, hard: 0.7 } as const;

export const mainQuestions = (i: Interview): InterviewQuestion[] => i.questions.filter((q) => !q.isFollowUp);
export const followUpCount = (i: Interview): number => i.questions.filter((q) => q.isFollowUp).length;

/** Number of follow-ups already asked on the thread `q` belongs to. */
export function threadDepth(interview: Interview, q: InterviewQuestion): number {
  const rootId = q.parentId ?? q.id;
  return interview.questions.filter((x) => x.parentId === rootId).length;
}

export function followUpBudget(interview: Interview): number {
  const share = interview.config.companyId ? 0.35 : FOLLOW_UP_SHARE[interview.config.difficulty];
  return Math.ceil(interview.config.questionLimit * share);
}

export function canAskFollowUp(interview: Interview, q: InterviewQuestion): boolean {
  // Company interviews should mostly use the company's own questions.
  const maxDepth = interview.config.companyId ? 1 : MAX_DEPTH[interview.config.difficulty];
  if (threadDepth(interview, q) >= maxDepth) return false;
  return followUpCount(interview) < followUpBudget(interview);
}

/** Every main question has been asked (follow-ups on the last one may still come). */
export function allMainsAsked(interview: Interview): boolean {
  return mainQuestions(interview).length >= interview.config.questionLimit;
}
