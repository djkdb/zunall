import Link from "next/link";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartGeometry, type Growth } from "@/services/career/growth";
import { cn } from "@/lib/utils";

/**
 * 성장 기록 카드.
 *
 * 준비도 점수 하나만 보여주면 잘하고 있는지 알 수 없다. 처음과 지금을 견주고,
 * 어느 항목에서 올랐는지까지 보여줘야 "계속 쓸 이유"가 된다.
 *
 * 색: 추이선은 본문 강조색, 상승/하락은 teal-600 / red-600 하나씩.
 * 두 색은 색맹 조건에서도 구분되지만(검증 통과), 그것만 믿지 않고
 * 화살표와 부호(+/-)를 항상 함께 붙여 색 없이도 방향을 읽을 수 있게 했다.
 */
const W = 520;
const H = 72;

export function GrowthCard({ growth }: { growth: Growth }) {
  // 기록이 하나뿐이면 선을 그릴 수 없다. 거짓 추세를 그리지 않고 사실을 말한다.
  if (!growth.hasTrend) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> 성장 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            오늘 점수 {growth.latestScore}점을 기록했습니다. 내일 다시 오면
            변화가 보이기 시작합니다.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            활동을 등록하거나 경험을 추가하면 그날의 점수가 자동으로 남습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { coords } = chartGeometry(growth.points, W, H);
  const line = coords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const start = coords[0];
  const end = coords[coords.length - 1];
  const rising = growth.delta > 0;
  const flat = growth.delta === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-muted-foreground" /> 성장 기록
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 헤드라인: 지금 몇 점이고 처음보다 얼마나 달라졌나 */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="text-3xl font-bold tabular-nums leading-none">
            {growth.latestScore}
            <span className="text-base font-medium text-muted-foreground">
              {" "}
              / 100
            </span>
          </p>
          <p
            className={cn(
              "flex items-center gap-0.5 text-sm font-semibold tabular-nums",
              flat
                ? "text-muted-foreground"
                : rising
                  ? "text-teal-600"
                  : "text-red-600",
            )}
          >
            {flat ? (
              <Minus className="h-4 w-4" aria-hidden />
            ) : rising ? (
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            ) : (
              <ArrowDownRight className="h-4 w-4" aria-hidden />
            )}
            {rising ? "+" : ""}
            {growth.delta}점
          </p>
          <p className="text-xs text-muted-foreground">
            {growth.days}일 전 {growth.firstScore}점에서 시작 · 기록{" "}
            {growth.points.length}일
          </p>
        </div>

        {/* 추이선. 점수가 y축, 시간이 x축 하나뿐이다(축을 둘로 나누지 않는다) */}
        <figure className="m-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[72px] w-full overflow-visible text-primary"
            role="img"
            aria-label={`준비도 점수 추이: ${growth.days}일 동안 ${growth.firstScore}점에서 ${growth.latestScore}점으로 변했습니다.`}
          >
            {/* 면은 채우지 않는다. 눈금이 0에서 시작하지 않으므로(좁은 구간을 늘려 본다)
                면을 칠하면 "0부터 이만큼 쌓였다"로 읽혀 변화가 과장된다. */}
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 각 점에 기본 툴팁을 달아, 마우스를 올리면 날짜와 점수를 읽을 수 있다 */}
            {coords.map((c) => (
              <circle
                key={c.point.day}
                cx={c.x}
                cy={c.y}
                r={7}
                fill="transparent"
              >
                <title>{`${c.point.day} · ${c.point.score}점`}</title>
              </circle>
            ))}
            {/* 첫 점과 끝 점만 표시한다. 모든 점에 숫자를 붙이면 읽을 수 없다 */}
            <circle
              cx={start.x}
              cy={start.y}
              r={4}
              fill="hsl(var(--card))"
              stroke="currentColor"
              strokeWidth={2}
            />
            <circle
              cx={end.x}
              cy={end.y}
              r={5}
              fill="currentColor"
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          </svg>
          <figcaption className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{growth.points[0].day}</span>
            <span>{growth.points[growth.points.length - 1].day}</span>
          </figcaption>
        </figure>

        {/* 어느 항목에서 달라졌나 — 이게 다음에 무엇을 할지 알려준다 */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
            어디서 달라졌나
          </p>
          <ul className="space-y-1 text-sm">
            {growth.itemDeltas.map((item) => (
              <li
                key={item.label}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {item.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="text-xs text-muted-foreground">
                    {item.from} → {item.to} / {item.max}
                  </span>
                  <span
                    className={cn(
                      "w-14 text-right font-semibold",
                      item.delta > 0
                        ? "text-teal-600"
                        : item.delta < 0
                          ? "text-red-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {item.delta > 0 ? "▲ +" : item.delta < 0 ? "▼ " : "– "}
                    {item.delta !== 0 ? item.delta : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {growth.bestItem && (
          <p className="rounded-md bg-accent/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            가장 많이 오른 곳은{" "}
            <b className="text-foreground">{growth.bestItem.label}</b>(
            {growth.bestItem.from} → {growth.bestItem.to})입니다.{" "}
            <Link
              href="/career/gaps"
              className="font-medium text-primary hover:underline"
            >
              지금 가장 부족한 곳 보기 →
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
