/**
 * Cavero 브랜드 마크.
 * 열린 C 링(방향을 정하기 전의 여백)과 그 틈으로 나아가는 파란 화살표 —
 * "다음 합격을 설계한다"는 제품의 뜻을 그대로 담은 형태다.
 *
 * 링은 currentColor 를 쓰므로 다크 모드에서 자동으로 밝아지고,
 * 화살표만 브랜드 블루로 고정된다.
 */
export const CAVERO_BLUE = "#2F6BFF";

export function CaveroMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Cavero">
      {/* 오른쪽이 열린 C — 12시 방향에서 시계 방향으로 감아 5시에서 끊는다 */}
      <path
        d="M45.8 48.5 A21.5 21.5 0 1 1 45.8 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="12.5"
        strokeLinecap="butt"
      />
      {/* 틈을 뚫고 나가는 화살표 */}
      <path
        d="M35.5 21 L54 32 L35.5 43 Z"
        fill={CAVERO_BLUE}
        stroke={CAVERO_BLUE}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 마크 + 워드마크. 로그인/스플래시처럼 브랜드를 크게 보여줄 때 쓴다. */
export function CaveroLogo({
  className = "",
  markClassName = "h-12 w-12",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <CaveroMark className={markClassName} />
      <span className="text-lg font-bold tracking-[0.32em] text-foreground">CAVERO</span>
    </div>
  );
}
