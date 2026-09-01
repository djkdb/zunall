// 도메인 전반에서 쓰는 enum 값과 한국어 라벨 / 색상 정의.
// DB에는 key(영문)를 저장하고 UI에서 라벨로 변환한다.

export const ACTIVITY_TYPES = {
  contest: "공모전",
  external: "대외활동",
  supporters: "서포터즈",
  hackathon: "해커톤",
  project: "프로젝트",
  education: "교육",
  intern: "인턴",
  recruit: "채용",
  opensource: "오픈소스",
  etc: "기타",
} as const;
export type ActivityType = keyof typeof ACTIVITY_TYPES;

export const ACTIVITY_STATUSES = {
  interested: "관심",
  planned: "지원 예정",
  applied: "지원 완료",
  active: "활동 중",
  submitted: "제출 완료",
  waiting: "결과 대기",
  won: "수상",
  lost: "탈락",
  done: "종료",
} as const;
export type ActivityStatus = keyof typeof ACTIVITY_STATUSES;

/** 진행 중으로 취급하는 상태 (대시보드 카운트 등) */
export const ONGOING_STATUSES: ActivityStatus[] = [
  "planned",
  "applied",
  "active",
  "submitted",
  "waiting",
];
/** 종료로 취급하는 상태 */
export const FINISHED_STATUSES: ActivityStatus[] = ["won", "lost", "done"];

export const STATUS_BADGE_CLASSES: Record<ActivityStatus, string> = {
  interested: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  planned: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  applied: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  active: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  submitted: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  waiting: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  done: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export const IMPORTANCE_LEVELS = {
  low: "낮음",
  medium: "보통",
  high: "높음",
} as const;
export type ImportanceLevel = keyof typeof IMPORTANCE_LEVELS;

export const EVENT_TYPES = {
  recruit_deadline: "모집 마감",
  apply_deadline: "지원 마감",
  ot: "OT",
  kickoff: "발대식",
  education: "교육",
  mid_submit: "중간 제출",
  final_submit: "최종 제출",
  presentation: "발표",
  interview: "면접",
  result: "결과 발표",
  etc: "기타 일정",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

/** 마감 성격의 일정 타입 (알림 생성 대상) */
export const DEADLINE_EVENT_TYPES: EventType[] = [
  "recruit_deadline",
  "apply_deadline",
  "mid_submit",
  "final_submit",
];

export const TASK_STATUSES = {
  todo: "TODO",
  in_progress: "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
} as const;
export type TaskStatus = keyof typeof TASK_STATUSES;

export const TASK_PRIORITIES = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  urgent: "긴급",
} as const;
export type TaskPriority = keyof typeof TASK_PRIORITIES;

export const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export const DOC_CATEGORIES = {
  notice: "공고 / 안내",
  reference: "참고자료",
  work: "내가 만든 자료",
  submission: "제출자료",
} as const;
export type DocCategory = keyof typeof DOC_CATEGORIES;

export const SUBMISSION_STATUSES = {
  draft: "작성 중",
  review_needed: "검토 필요",
  ai_reviewed: "AI 리뷰 완료",
  final: "최종 확정",
  submitted: "제출 완료",
} as const;
export type SubmissionStatus = keyof typeof SUBMISSION_STATUSES;

export const NOTIFICATION_TYPES = {
  schedule: "일정",
  file: "파일",
  ai: "AI 평가",
  system: "시스템",
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const AI_ACTIONS = {
  analyze_announcement: "공고문 분석",
  analyze_opportunity: "요구 역량 분석",
  extract_criteria: "평가 기준 추출",
  fit_analysis: "내 적합도 분석",
  evaluate_submission: "제출물 평가",
  proofread: "문서 첨삭",
  improvements: "개선점 찾기",
  expected_questions: "예상 질문 생성",
  final_check: "제출 전 최종 검토",
} as const;
export type AIAction = keyof typeof AI_ACTIONS;

export const CRITERIA_SOURCES = {
  official: "공식 평가기준",
  inferred: "문서에서 추론",
  manual: "직접 입력",
} as const;
export type CriteriaSource = keyof typeof CRITERIA_SOURCES;

/** 활동별 캘린더 색상 팔레트 (생성 시 순환 배정) */
export const ACTIVITY_COLORS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
] as const;

/** D-day 알림 기준 (며칠 전) */
export const NOTIFY_THRESHOLDS = [7, 3, 1, 0] as const;

export const HISTORY_KINDS = {
  created: "활동 생성",
  status: "상태 변경",
  updated: "정보 수정",
  file: "파일",
  submission: "제출물",
  ai: "AI",
  task: "작업",
  event: "일정",
  note: "메모",
} as const;
export type HistoryKind = keyof typeof HISTORY_KINDS;

export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "png", "jpg", "jpeg", "gif", "webp", "svg",
  "zip", "txt", "md", "csv", "hwp", "hwpx", "key", "mp4", "mov",
] as const;
