/**
 * The interview panel (다대일 면접). Fictional interviewers — the AI speaks
 * through whichever seat fits the kind of question being asked.
 */
import type { CustomRole, QuestionType } from "./shared/schemas";
import { practitionerDept, roleContextFor } from "./shared/roles";

export type Seat = "left" | "center" | "right";

export interface Look {
  suit: string;
  shirt: string;
  tie: string | null;
  skin: string;
  hair: string;
  hairStyle: "short" | "side" | "bob" | "neat";
  glasses: boolean;
}

export interface PanelMember {
  seat: Seat;
  name: string;
  title: string;
  /** Role shown on the name plate. */
  role: string;
  look: Look;
  voice: { pitch: number; rate: number; index: number };
}

export interface JobRef {
  position: string;
  roleId?: string;
  customRole?: CustomRole;
}

/** The practitioner's department for the job: "재무회계팀" for an accountant, "간호부" for a nurse. */
export function departmentFor(job: string | JobRef): string {
  return practitionerDept(roleContextFor(typeof job === "string" ? { position: job } : job));
}

export function buildPanel(job: string | JobRef): Record<Seat, PanelMember> {
  return {
    left: {
      seat: "left",
      name: "이서연",
      title: "책임",
      role: "인사팀",
      look: { suit: "#3f4452", shirt: "#f4f1ec", tie: null, skin: "#f1d2b8", hair: "#2a211d", hairStyle: "bob", glasses: false },
      voice: { pitch: 1.2, rate: 1.03, index: 1 },
    },
    center: {
      seat: "center",
      name: "김도윤",
      title: "팀장",
      role: "면접위원장",
      look: { suit: "#1f2b45", shirt: "#ffffff", tie: "#7d2a33", skin: "#e9c6a6", hair: "#1c1a19", hairStyle: "neat", glasses: false },
      voice: { pitch: 0.85, rate: 0.98, index: 0 },
    },
    right: {
      seat: "right",
      name: "박준호",
      title: "선임",
      role: departmentFor(job),
      look: { suit: "#4a4f58", shirt: "#e8eef6", tie: null, skin: "#efcfb2", hair: "#241e1a", hairStyle: "side", glasses: true },
      voice: { pitch: 1.0, rate: 1.06, index: 2 },
    },
  };
}

/**
 * Which interviewer asks a given question — like a real panel taking turns:
 * HR asks about motivation, values and behavior; the practitioner asks the job
 * questions (for every job, not just engineers); the chair opens, presses and closes.
 */
const PRACTITIONER = new Set<QuestionType>(["technical", "role_specific", "case", "numerical", "analytical", "industry", "role_understanding", "pt"]);
const HR = new Set<QuestionType>(["motivation", "reflection", "behavioral", "ethics", "communication", "company_understanding"]);

export function seatFor(type: QuestionType, isFollowUp: boolean): Seat {
  if (PRACTITIONER.has(type)) return "right";
  if (isFollowUp) return type === "deep_dive" || type === "experience" ? "right" : "center";
  if (HR.has(type)) return "left";
  return "center";
}

/** Stable 4-digit applicant number (지원번호) derived from the interview id. */
export function applicantNumber(id: string): string {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(1000 + (h % 9000));
}
