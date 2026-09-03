/**
 * 주간 리포트 문구 만들기 (순수 함수).
 * DB 조회와 분리해 두어 문구만 따로 검증할 수 있다.
 */

import { ddayLabel, daysUntil } from "@/lib/utils";

export interface WeeklyReport {
  title: string;
  body: string;
  /** 푸시 본문 (짧게) */
  push: string;
}

export function buildWeeklyReport(input: {
  upcoming: Array<{ name: string; what: string; date: string }>;
  doneTasks: number;
  newActivities: number;
  scoreLatest: number | null;
  scoreWeekAgo: number | null;
  nextAction: string | null;
}): WeeklyReport {
  const { upcoming, doneTasks, newActivities, scoreLatest, scoreWeekAgo, nextAction } = input;

  const lines: string[] = [];

  if (upcoming.length === 0) {
    lines.push("이번 주 마감은 없습니다.");
  } else {
    lines.push(`이번 주 마감 ${upcoming.length}건`);
    for (const item of upcoming.slice(0, 3)) {
      const days = daysUntil(item.date);
      const dday = days === null ? "" : `${ddayLabel(days)} `;
      lines.push(`· ${dday}${item.name} ${item.what}`);
    }
    if (upcoming.length > 3) lines.push(`· 외 ${upcoming.length - 3}건`);
  }

  const past: string[] = [];
  if (doneTasks > 0) past.push(`작업 ${doneTasks}건 완료`);
  if (newActivities > 0) past.push(`활동 ${newActivities}개 추가`);
  if (past.length > 0) lines.push(`지난 주: ${past.join(" · ")}`);

  if (scoreLatest !== null) {
    const changed = scoreWeekAgo !== null && scoreWeekAgo !== scoreLatest;
    lines.push(
      changed
        ? `Career Score ${scoreWeekAgo} → ${scoreLatest} (최근 30일)`
        : `Career Score ${scoreLatest}`,
    );
  }

  if (nextAction) lines.push(`다음 행동: ${nextAction}`);

  const head =
    upcoming.length > 0
      ? `이번 주 마감 ${upcoming.length}건`
      : doneTasks + newActivities > 0
        ? "이번 주 요약"
        : "이번 주도 시작해볼까요";

  return {
    title: `주간 리포트 — ${head}`,
    body: lines.join("\n"),
    push: lines.slice(0, 3).join(" / "),
  };
}
