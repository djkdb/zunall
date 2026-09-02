/**
 * DATABASE_URL 정리와 점검.
 *
 * 콘솔에서 복사하다 보면 값 앞뒤에 따옴표가 붙거나 `psql ` 이 딸려오거나
 * `DATABASE_URL=` 채로 들어오는 일이 잦다. 그대로 두면 드라이버가
 * "Invalid URL string" 만 뱉어 원인을 알 수 없으므로,
 * (1) 흔한 군더더기는 자동으로 걷어내고 (2) 남은 문제는 이름을 붙여 알려준다.
 */

/** 값 앞뒤의 군더더기를 제거한다. 비밀값은 로그로 남기지 않는다. */
export function normalizeDatabaseUrl(raw: string): string {
  let value = raw.trim();

  // psql "postgresql://..." / psql 'postgresql://...'
  value = value.replace(/^psql\s+/i, "").trim();
  // DATABASE_URL=postgresql://...  (env 파일 한 줄을 통째로 붙여넣은 경우)
  value = value.replace(/^(export\s+)?DATABASE_URL\s*=\s*/i, "").trim();
  // 감싸는 따옴표 / 꺾쇠
  value = value.replace(/^["'`<]+/, "").replace(/["'`>]+$/, "").trim();

  return value;
}

export interface DatabaseUrlReport {
  /** 스킴 (postgresql / postgres 등). 못 읽으면 null */
  scheme: string | null;
  /** 호스트의 뒤 두 마디만 (예: neon.tech). 비밀값이 아니며 원인 파악에 필요 */
  hostSuffix: string | null;
  /** 사용자/비밀번호가 들어있는지 (값은 노출하지 않음) */
  hasCredentials: boolean;
  /** 정리 과정에서 실제로 걷어낸 군더더기가 있었는지 */
  cleaned: boolean;
  /** 사람이 읽을 수 있는 문제 목록 */
  issues: string[];
}

export function inspectDatabaseUrl(raw: string): DatabaseUrlReport {
  const normalized = normalizeDatabaseUrl(raw);
  const report: DatabaseUrlReport = {
    scheme: null,
    hostSuffix: null,
    hasCredentials: false,
    cleaned: normalized !== raw.trim(),
    issues: [],
  };

  if (!normalized) {
    report.issues.push("값이 비어 있습니다.");
    return report;
  }
  if (/\s/.test(normalized)) {
    report.issues.push("값 안에 공백이나 줄바꿈이 들어 있습니다. 한 줄로 붙여넣어 주세요.");
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    report.issues.push(
      "PostgreSQL 접속 문자열 형식이 아닙니다. " +
        "postgresql://<사용자>:<비밀번호>@<호스트>/<DB이름>?sslmode=require 형태여야 합니다.",
    );
    return report;
  }

  report.scheme = url.protocol.replace(":", "");
  const labels = url.hostname.split(".");
  report.hostSuffix = labels.slice(-2).join(".") || null;
  report.hasCredentials = Boolean(url.username && url.password);

  if (!["postgres", "postgresql"].includes(report.scheme)) {
    report.issues.push(
      `스킴이 '${report.scheme}' 입니다. postgresql:// 로 시작하는 주소여야 합니다.`,
    );
  }
  if (!url.hostname) {
    report.issues.push("호스트가 없습니다.");
  }
  if (!report.hasCredentials) {
    report.issues.push("사용자 이름 또는 비밀번호가 빠져 있습니다.");
  }
  if (url.pathname.replace("/", "") === "") {
    report.issues.push("데이터베이스 이름이 빠져 있습니다. (주소 끝의 /dbname)");
  }
  if (/<|>|여기에|your[-_]?(password|host)/i.test(normalized)) {
    report.issues.push("예시 문구(<비밀번호> 등)가 그대로 남아 있습니다.");
  }

  return report;
}
