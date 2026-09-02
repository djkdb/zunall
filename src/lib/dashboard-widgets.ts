/** 대시보드 위젯 정의. 순서가 곧 기본 표시 순서다. */
export const DASHBOARD_WIDGETS = {
  metrics: "요약 지표 (활동·일정·작업·AI)",
  careerStart: "커리어 시작 안내 / Career Score",
  mission: "오늘의 커리어 미션",
  deadlines: "다가오는 마감",
  tasks: "이번 주 해야 할 일",
  activities: "최근 활동",
  notifications: "최근 알림",
} as const;

export type WidgetKey = keyof typeof DASHBOARD_WIDGETS;

export const DEFAULT_WIDGETS: WidgetKey[] = [
  "metrics",
  "careerStart",
  "mission",
  "deadlines",
  "tasks",
  "activities",
  "notifications",
];

/** 저장된 값을 안전하게 위젯 목록으로 바꾼다 (알 수 없는 키는 버린다) */
export function parseWidgets(json: string | null | undefined): WidgetKey[] {
  if (!json) return DEFAULT_WIDGETS;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS;
    const keys = parsed.filter(
      (key): key is WidgetKey => typeof key === "string" && key in DASHBOARD_WIDGETS,
    );
    return keys.length > 0 ? keys : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}
