"use client";

import * as React from "react";
import type { PanelMember, Seat } from "@/services/mock-interview/panel";
import { PANEL_PHOTOS, PHOTO_BOX, photoSrc, type PhotoState } from "@/services/mock-interview/panel-photos";

/**
 * 면접실 (zunterview 의 사진 면접실). 지원자 자리에서 본 3인 면접관 패널.
 * 지금 질문하는 면접관은 말하고, 답변을 검토하는 동안엔 모두 평가지를 본다.
 */
export type RoomMode = "idle" | "asking" | "listening" | "reviewing";

const SCENE = { width: 1200, height: 520 };
const ROOM_SRC = "/panel/room.webp";
const SEAT_X: Record<Seat, number> = { left: 316, center: 600, right: 886 };
const DESK_Y = 414;
const PHOTO_W = 240;
const PHOTO_H = (PHOTO_W * PHOTO_BOX.height) / PHOTO_BOX.width;
const PHOTO_TOP = DESK_Y + 4 - PHOTO_H;
const HOLD: Record<PhotoState, number> = { talk: 2300, review: 3400, think: 4200, idle: 6500 };
const SEATS: Seat[] = ["left", "center", "right"];

function useReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

function Interviewer({ seat, state, offset }: { seat: Seat; state: PhotoState; offset: number }) {
  const set = PANEL_PHOTOS[seat]!;
  const reduce = useReducedMotion();
  const [tick, setTick] = React.useState(offset);
  React.useEffect(() => {
    if (reduce || set[state] < 2) return;
    const id = window.setInterval(() => setTick((t) => t + 1), HOLD[state] + offset * 370);
    return () => window.clearInterval(id);
  }, [reduce, set, state, offset]);
  const active = tick % set[state];
  // 지금 상태의 프레임만 그린다 (전부 미리 그리면 사진 52장을 한꺼번에 받는다)
  return (
    <g transform={`translate(${SEAT_X[seat] - PHOTO_W / 2} ${PHOTO_TOP})`}>
      {Array.from({ length: set[state] }, (_, n) => (
        <image
          key={`${state}-${n}`}
          href={photoSrc(seat, state, n)}
          width={PHOTO_W}
          height={PHOTO_H}
          preserveAspectRatio="xMidYMax meet"
          style={{ opacity: n === active ? 1 : 0, transition: reduce ? undefined : "opacity 420ms ease" }}
        />
      ))}
    </g>
  );
}

export function PanelScene({
  panel,
  speaking,
  mode,
  typing,
  label,
}: {
  panel: Record<Seat, PanelMember>;
  speaking: Seat | null;
  mode: RoomMode;
  /** 지원자가 답을 쓰는 중이면 면접관이 고개를 끄덕인다 */
  typing: boolean;
  label: string;
}) {
  const stateOf = (seat: Seat): PhotoState =>
    mode === "asking" && speaking === seat ? "talk" : mode === "reviewing" ? "review" : mode === "listening" && typing && seat !== "center" ? "think" : "idle";
  return (
    <svg
      viewBox="150 120 900 395"
      className="h-auto w-full select-none rounded-lg bg-[#2b2f36]"
      role="img"
      aria-label={`면접관 3명 (${SEATS.map((s) => `${panel[s].role} ${panel[s].name}`).join(", ")})`}
    >
      <defs>
        <clipPath id="mi-desk">
          <rect x="0" y={DESK_Y} width={SCENE.width} height={SCENE.height - DESK_Y} />
        </clipPath>
      </defs>
      <image href={ROOM_SRC} width={SCENE.width} height={SCENE.height} preserveAspectRatio="none" />
      <text x="601" y="182" textAnchor="middle" fill="#9fb0c9" fontSize="16" opacity="0.92">
        {label}
      </text>
      {SEATS.map((seat, i) => (
        <Interviewer key={seat} seat={seat} state={stateOf(seat)} offset={i} />
      ))}
      <image href={ROOM_SRC} width={SCENE.width} height={SCENE.height} preserveAspectRatio="none" clipPath="url(#mi-desk)" />
      <rect x="0" y={DESK_Y} width={SCENE.width} height="5" fill="#000" opacity="0.12" />
      {SEATS.map((seat) => {
        const m = panel[seat];
        const active = mode === "asking" && speaking === seat;
        return (
          <g key={seat} transform={`translate(${SEAT_X[seat]} ${DESK_Y + 30})`}>
            <rect x="-74" y="-16" width="148" height="34" rx="3" fill={active ? "#1b3a6b" : "#f5f2ea"} stroke="#00000022" />
            <text x="0" y="-1" textAnchor="middle" fontSize="11" fill={active ? "#cfe0ff" : "#5b6170"}>
              {m.role}
            </text>
            <text x="0" y="13" textAnchor="middle" fontSize="13" fontWeight="600" fill={active ? "#ffffff" : "#1f2430"}>
              {m.name} {m.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
