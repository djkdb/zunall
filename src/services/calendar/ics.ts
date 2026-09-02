/**
 * iCalendar(.ics) 생성.
 * 구글/애플 캘린더가 구독할 수 있는 형식으로 마감과 일정을 내보낸다.
 * RFC 5545 의 필수 규칙(줄 접기, 특수문자 이스케이프, 종일 일정의 배타적 DTEND)을 지킨다.
 */

export interface IcsEntry {
  uid: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm — 있으면 시간 일정, 없으면 종일 일정 */
  time?: string | null;
  /** 종일 일정의 마지막 날 (YYYY-MM-DD, 포함) */
  endDate?: string | null;
  description?: string | null;
  /** 며칠 전에 알림 */
  alarmDaysBefore?: number;
}

const CRLF = "\r\n";

/** 쉼표·세미콜론·역슬래시·개행을 iCalendar 규칙대로 이스케이프 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 한 줄은 75옥텟을 넘을 수 없다 — 넘으면 다음 줄 앞에 공백을 붙여 잇는다 */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // 멀티바이트 문자를 자르지 않도록 뒤로 물러난다
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf-8"));
    start = end;
    limit = 74; // 이어지는 줄은 앞에 공백 한 칸이 붙는다
  }
  return parts.join(CRLF + " ");
}

function stampUtc(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function dateOnly(value: string): string {
  return value.replace(/-/g, "");
}

function addDays(value: string, days: number): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Asia/Seoul 은 서머타임이 없어 고정 +09:00 로 표현할 수 있다 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Seoul",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0900",
  "TZOFFSETTO:+0900",
  "TZNAME:KST",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildIcs(entries: IcsEntry[], calendarName = "Cavero"): string {
  const now = stampUtc();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cavero//Career OS//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escapeIcsText(calendarName),
    "X-WR-TIMEZONE:Asia/Seoul",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    ...VTIMEZONE,
  ];

  for (const entry of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + entry.uid + "@cavero");
    lines.push("DTSTAMP:" + now);

    if (entry.time && /^\d{2}:\d{2}$/.test(entry.time)) {
      const start = dateOnly(entry.date) + "T" + entry.time.replace(":", "") + "00";
      lines.push("DTSTART;TZID=Asia/Seoul:" + start);
      lines.push("DURATION:PT1H");
    } else {
      // 종일 일정의 DTEND 는 '다음 날'(배타적)이어야 한다
      const last =
        entry.endDate && /^\d{4}-\d{2}-\d{2}$/.test(entry.endDate) ? entry.endDate : entry.date;
      lines.push("DTSTART;VALUE=DATE:" + dateOnly(entry.date));
      lines.push("DTEND;VALUE=DATE:" + dateOnly(addDays(last, 1)));
    }

    lines.push("SUMMARY:" + escapeIcsText(entry.title));
    if (entry.description) lines.push("DESCRIPTION:" + escapeIcsText(entry.description));

    if (entry.alarmDaysBefore && entry.alarmDaysBefore > 0) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push("TRIGGER:-P" + entry.alarmDaysBefore + "D");
      lines.push("DESCRIPTION:" + escapeIcsText(entry.title));
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
