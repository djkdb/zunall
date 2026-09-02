/** iCalendar 생성 단위 테스트. 실행: npx tsx tests/ics.test.ts */
import { buildIcs, escapeIcsText, foldIcsLine } from "../src/services/calendar/ics";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

check("이스케이프: 쉼표·세미콜론·역슬래시", escapeIcsText("a,b;c\\d") === "a\\,b\;c\\\\d", escapeIcsText("a,b;c\\d"));
check("이스케이프: 개행", escapeIcsText("첫 줄\n둘째 줄") === "첫 줄\\n둘째 줄");

const long = "SUMMARY:" + "가".repeat(60);
const folded = foldIcsLine(long);
check("75옥텟 초과 줄 접기", folded.includes("\r\n "), `${folded.split("\r\n").length}줄`);
check("접힌 줄을 되돌리면 원본", folded.split("\r\n ").join("") === long);
check("짧은 줄은 그대로", foldIcsLine("SUMMARY:짧음") === "SUMMARY:짧음");

const ics = buildIcs(
  [
    { uid: "a1", title: "[지원 마감] 2026 공모전, 본선", date: "2026-10-20", alarmDaysBefore: 3 },
    { uid: "a2", title: "발표회", date: "2026-11-05", time: "14:30" },
    { uid: "a3", title: "활동 기간", date: "2026-09-01", endDate: "2026-09-30" },
    { uid: "bad", title: "잘못된 날짜", date: "2026/13/40" },
  ],
  "Cavero — 이성준",
);

check("VCALENDAR 감싸기", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trimEnd().endsWith("END:VCALENDAR"));
check("모든 줄이 CRLF", !/[^\r]\n/.test(ics));
check("VEVENT 3개 (잘못된 날짜 제외)", (ics.match(/BEGIN:VEVENT/g) ?? []).length === 3);
check("종일 일정은 DATE 값", ics.includes("DTSTART;VALUE=DATE:20261020"));
check("종일 DTEND 는 다음 날(배타적)", ics.includes("DTEND;VALUE=DATE:20261021"));
check("기간 일정의 DTEND 는 마지막날+1", ics.includes("DTSTART;VALUE=DATE:20260901") && ics.includes("DTEND;VALUE=DATE:20261001"));
check("시간 일정은 TZID 사용", ics.includes("DTSTART;TZID=Asia/Seoul:20261105T143000"));
check("VTIMEZONE 포함", ics.includes("BEGIN:VTIMEZONE") && ics.includes("TZID:Asia/Seoul"));
check("제목의 쉼표 이스케이프", ics.includes("2026 공모전\\, 본선"));
check("알림(VALARM) 3일 전", ics.includes("TRIGGER:-P3D"));
check("캘린더 이름", ics.includes("X-WR-CALNAME:Cavero — 이성준"));

console.log(failed === 0 ? "\n모든 테스트 통과" : `\n${failed}개 실패`);
process.exit(failed === 0 ? 0 : 1);
