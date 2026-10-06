/**
 * 소개 화면의 제품 미리보기. 실제 화면 캡처 대신 실제 화면에 나오는 요소
 * (면접실 사진, 적합도 판단, 마감 카드)를 가볍게 다시 그린다 — 글자가 흐려지지 않고 다크 모드도 맞는다.
 */
const SEATS = [
  { seat: "left", x: 316, role: "인사팀", name: "이서연 책임" },
  { seat: "center", x: 600, role: "면접위원장", name: "김도윤 팀장" },
  { seat: "right", x: 886, role: "실무진", name: "박준호 선임" },
] as const;
const DESK_Y = 414;
const PHOTO_W = 240;
const PHOTO_H = (PHOTO_W * 230) / 300;

export function InterviewRoomPreview({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="150 120 900 395" className={`h-auto w-full rounded-lg bg-[#2b2f36] ${className}`} role="img" aria-label="AI 모의 면접실: 면접관 3명">
      <defs>
        <clipPath id="wp-desk">
          <rect x="0" y={DESK_Y} width="1200" height={520 - DESK_Y} />
        </clipPath>
      </defs>
      <image href="/panel/room.webp" width="1200" height="520" preserveAspectRatio="none" />
      <text x="601" y="182" textAnchor="middle" fill="#9fb0c9" fontSize="16">
        모의면접
      </text>
      {SEATS.map((s) => (
        <image
          key={s.seat}
          href={`/panel/${s.seat}/${s.seat === "right" ? "talk-1" : "idle-1"}.webp`}
          x={s.x - PHOTO_W / 2}
          y={DESK_Y + 4 - PHOTO_H}
          width={PHOTO_W}
          height={PHOTO_H}
          preserveAspectRatio="xMidYMax meet"
        />
      ))}
      <image href="/panel/room.webp" width="1200" height="520" preserveAspectRatio="none" clipPath="url(#wp-desk)" />
      {SEATS.map((s) => (
        <g key={s.seat} transform={`translate(${s.x} ${DESK_Y + 30})`}>
          <rect x="-74" y="-16" width="148" height="34" rx="3" fill={s.seat === "right" ? "#1b3a6b" : "#f5f2ea"} />
          <text x="0" y="-1" textAnchor="middle" fontSize="11" fill={s.seat === "right" ? "#cfe0ff" : "#5b6170"}>
            {s.role}
          </text>
          <text x="0" y="13" textAnchor="middle" fontSize="13" fontWeight="600" fill={s.seat === "right" ? "#fff" : "#1f2430"}>
            {s.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** 히어로 오른쪽: 면접실 + 실제 화면에 나오는 카드 세 장 */
export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:mx-0" aria-hidden="true">
      <div className="rounded-xl border bg-card p-2 shadow-xl shadow-primary/5">
        <InterviewRoomPreview />
        <div className="space-y-1 px-2 pb-2 pt-3">
          <p className="text-[11px] text-muted-foreground">실무진 박준호 선임 · 꼬리질문</p>
          <p className="text-sm font-semibold leading-snug">60%라는 수치는 어떻게 측정하셨나요?</p>
        </div>
      </div>

      <div className="absolute -left-4 -top-7 hidden items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-lg sm:flex lg:-left-10">
        <span className="text-2xl font-bold text-primary">82</span>
        <span>
          <span className="block text-[11px] text-muted-foreground">지원 적합도 · 네이버 인턴</span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">지원 추천</span>
        </span>
      </div>

      <div className="absolute -right-3 -top-8 hidden w-44 rounded-lg border bg-card p-3 shadow-lg sm:block lg:-right-8">
        <p className="text-[11px] font-semibold text-rose-600">오늘 가장 급한 것</p>
        <p className="mt-1 text-sm font-semibold leading-snug">서비스 기획 인턴 서류 마감</p>
        <p className="mt-0.5 text-xs font-bold text-rose-600">D-2</p>
      </div>

      <div className="absolute -bottom-10 -right-2 hidden w-56 rounded-lg border bg-card p-3 shadow-lg sm:block lg:-right-6">
        <p className="text-[11px] text-muted-foreground">면접 리포트</p>
        <div className="mt-1.5 space-y-1">
          {[
            ["구체성", 58],
            ["답변 구조", 74],
            ["질문 이해도", 86],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[4.5rem_1fr_1.5rem] items-center gap-1.5 text-[11px]">
              <span>{k}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
