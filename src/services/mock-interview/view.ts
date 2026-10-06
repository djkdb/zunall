/**
 * 면접실 화면에 넘기는 값. 분석 결과·서류 원문·면접관 내부 판단(꼬리질문 이유)은
 * 면접 중에는 보내지 않는다 — 실제 면접처럼 끝나고 리포트에서 본다.
 */
import { seatFor, type Seat } from "./panel";
import { mainQuestions } from "./utils/policy";
import type { Interview } from "./types";
import type { QuestionType } from "./shared/schemas";

export interface RoomQuestion {
  id: string;
  text: string;
  type: QuestionType;
  isFollowUp: boolean;
  seat: Seat;
  /** 이 질문 앞에 면접관이 한 말 */
  reaction: string | null;
  origin: string | null;
  clarified: boolean;
}

export interface RoomView {
  id: string;
  position: string;
  companyName: string | null;
  activityId: string | null;
  completed: boolean;
  current: RoomQuestion | null;
  /** 본 질문 몇 번째인지 (꼬리질문은 같은 번호) */
  mainIndex: number;
  total: number;
  followUps: number;
  /** 지금까지 한 문답 (점수 없이) */
  history: Array<{ id: string; text: string; isFollowUp: boolean; answer: string }>;
  voiceEnabled: boolean;
  documentBased: boolean;
}

export function toRoomView(i: Interview, row: { activityId: string | null; companyName: string | null }): RoomView {
  const last = i.questions[i.questions.length - 1];
  const current = last && !last.answer ? last : null;
  return {
    id: i.id,
    position: i.config.position,
    companyName: row.companyName,
    activityId: row.activityId,
    completed: i.completed,
    current: current
      ? {
          id: current.id,
          text: current.text,
          type: current.type,
          isFollowUp: current.isFollowUp,
          seat: seatFor(current.type, current.isFollowUp),
          reaction: current.reaction ?? null,
          origin: current.origin ?? null,
          clarified: Boolean(current.clarified),
        }
      : null,
    mainIndex: Math.max(1, mainQuestions(i).length),
    total: i.config.questionLimit,
    followUps: i.questions.filter((q) => q.isFollowUp).length,
    history: i.questions.filter((q) => q.answer).map((q) => ({ id: q.id, text: q.text, isFollowUp: q.isFollowUp, answer: q.answer ?? "" })),
    voiceEnabled: i.config.voiceEnabled,
    documentBased: Boolean(i.config.documents && (i.config.documents.resume.trim() || i.config.documents.coverLetter.trim())),
  };
}
