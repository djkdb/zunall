/** 알림 설정 파싱·시간 판단 테스트. 실행: tsx tests/notify-settings.test.ts */
import {
  parseNotifySettings,
  isQuietHour,
  isWeeklyReportDay,
  weekKey,
  localParts,
  DEFAULT_NOTIFY_SETTINGS,
} from "../src/services/notification/settings";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};

const KST = 540;
/** 한국 시간 기준으로 UTC 밀리초를 만든다 */
const kst = (iso: string) => Date.parse(`${iso}+09:00`);

// ── 파싱 ─────────────────────────────────────────────────────
check("설정이 없으면 기본값", parseNotifySettings(null).thresholds.join() === DEFAULT_NOTIFY_SETTINGS.thresholds.join());
check(
  "임계일은 내림차순으로 정리",
  parseNotifySettings({ notifyThresholds: "[1,7,3]" }).thresholds.join() === "7,3,1",
);
check(
  "모르는 임계일은 버린다",
  parseNotifySettings({ notifyThresholds: "[7,99,3]" }).thresholds.join() === "7,3",
);
check(
  "전부 끄면 빈 목록 (기본값으로 되돌리지 않음)",
  parseNotifySettings({ notifyThresholds: "[]" }).thresholds.length === 0,
);
check(
  "모르는 알림 종류는 버린다",
  parseNotifySettings({ notifyTypes: '["schedule","없는종류"]' }).types.join() === "schedule",
);
check("깨진 JSON 은 빈 값으로", parseNotifySettings({ notifyThresholds: "{{" }).thresholds.length === 0);
check("시간 범위를 벗어난 값은 무시", parseNotifySettings({ quietStart: 30, quietEnd: 7 }).quietStart === null);
check("이상한 시간대는 기본값", parseNotifySettings({ timezoneOffset: 99999 }).timezoneOffset === 540);
check("요일 범위 밖은 일요일", parseNotifySettings({ weeklyDay: 9 }).weeklyDay === 0);

// ── 조용한 시간 ──────────────────────────────────────────────
const night = parseNotifySettings({ quietStart: 22, quietEnd: 7, timezoneOffset: KST });
check("한밤중은 조용한 시간", isQuietHour(kst("2026-09-03T23:30"), night));
check("새벽도 조용한 시간", isQuietHour(kst("2026-09-04T06:00"), night));
check("아침은 아님", !isQuietHour(kst("2026-09-04T08:00"), night));
check("낮도 아님", !isQuietHour(kst("2026-09-04T15:00"), night));

const day = parseNotifySettings({ quietStart: 9, quietEnd: 18, timezoneOffset: KST });
check("자정을 넘지 않는 구간", isQuietHour(kst("2026-09-04T12:00"), day) && !isQuietHour(kst("2026-09-04T20:00"), day));
check("설정 없으면 항상 허용", !isQuietHour(kst("2026-09-04T03:00"), parseNotifySettings(null)));
check(
  "시작과 끝이 같으면 적용 안 함",
  !isQuietHour(kst("2026-09-04T03:00"), parseNotifySettings({ quietStart: 5, quietEnd: 5 })),
);

// ── 시간대 처리 ──────────────────────────────────────────────
// UTC 로는 아직 3일 22시지만 한국은 4일 07시다
check("시간대가 날짜를 바꾼다", localParts(Date.parse("2026-09-03T22:00Z"), KST).day === 4);
check("시간대가 시각을 바꾼다", localParts(Date.parse("2026-09-03T22:00Z"), KST).hour === 7);

// ── 주간 리포트 요일 ─────────────────────────────────────────
const sunday = parseNotifySettings({ weeklyDay: 0, timezoneOffset: KST });
check("일요일에만 보낸다", isWeeklyReportDay(kst("2026-09-06T19:00"), sunday));
check("월요일에는 안 보낸다", !isWeeklyReportDay(kst("2026-09-07T19:00"), sunday));
check(
  "끄면 보내지 않는다",
  !isWeeklyReportDay(kst("2026-09-06T19:00"), parseNotifySettings({ weeklyReport: 0 })),
);
check(
  "UTC 로는 토요일이어도 한국은 일요일",
  isWeeklyReportDay(Date.parse("2026-09-05T22:00Z"), sunday),
);

// ── 주차 키 ─────────────────────────────────────────────────
check(
  "같은 주는 같은 키",
  weekKey(kst("2026-09-06T19:00"), KST) === weekKey(kst("2026-09-08T09:00"), KST),
);
check(
  "다음 주는 다른 키",
  weekKey(kst("2026-09-06T19:00"), KST) !== weekKey(kst("2026-09-13T19:00"), KST),
);

console.log(`\n${passed}개 통과${failed > 0 ? `, ${failed}개 실패` : ""}`);
if (failed > 0) process.exit(1);

// ── 주간 리포트 문구 ─────────────────────────────────────────
import { buildWeeklyReport } from "../src/services/notification/weekly-format";

const full = buildWeeklyReport({
  upcoming: [
    { name: "그린테크 공모전", what: "지원 마감", date: "2099-01-01" },
    { name: "마케팅 공모전", what: "제출 마감", date: "2099-01-02" },
    { name: "해커톤", what: "결과 발표", date: "2099-01-03" },
    { name: "인턴 지원", what: "지원 마감", date: "2099-01-04" },
  ],
  doneTasks: 5,
  newActivities: 2,
  scoreLatest: 72,
  scoreWeekAgo: 65,
  nextAction: "포트폴리오 정리하기",
});
check("마감 건수를 제목에", full.title.includes("4건"), full.title);
check("상위 3건만 나열", (full.body.match(/^· /gm) ?? []).length === 4, full.body);
check("나머지는 개수로", full.body.includes("외 1건"));
check("지난 주 성과 포함", full.body.includes("작업 5건 완료") && full.body.includes("활동 2개 추가"));
check("점수 변화 표시", full.body.includes("65 → 72"));
check("다음 행동 포함", full.body.includes("포트폴리오 정리하기"));
check("푸시는 짧게", full.push.split("/").length <= 3);

const quiet = buildWeeklyReport({
  upcoming: [],
  doneTasks: 0,
  newActivities: 0,
  scoreLatest: null,
  scoreWeekAgo: null,
  nextAction: null,
});
check("할 일이 없으면 격려 문구", quiet.title.includes("시작"), quiet.title);
check("마감 없음 안내", quiet.body.includes("이번 주 마감은 없습니다"));

console.log(`\n최종 ${passed}개 통과${failed > 0 ? `, ${failed}개 실패` : ""}`);
if (failed > 0) process.exit(1);
