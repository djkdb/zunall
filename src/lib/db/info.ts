/**
 * DB 연결 상태를 사람이 읽을 수 있는 문자열로 요약한다(설정 화면 표시용).
 * 접속 문자열 자체는 절대 노출하지 않고, 호스트 종류와 드라이버만 알려준다.
 */
import { normalizeDatabaseUrl } from "./url";

export function databaseKind(): string {
  const raw = process.env.DATABASE_URL;
  const url = raw ? normalizeDatabaseUrl(raw) : undefined;
  if (!url) return "PGlite (내장, 로컬 전용)";

  const forced = process.env.DB_DRIVER;
  const isNeon = /(^|[@.])neon\.tech/.test(url);
  const isSupabase = /supabase\.(co|com)/.test(url);
  const onWorkers =
    (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ===
    "Cloudflare-Workers";

  const host = isNeon ? "Neon" : isSupabase ? "Supabase" : "PostgreSQL";
  // src/lib/db/index.ts 의 useNeonHttp() 와 동일한 판정
  const useHttp =
    forced === "neon-http" ? true : forced === "postgres-js" ? false : onWorkers && isNeon;
  return `${host} (${useHttp ? "neon-http" : "postgres-js"})`;
}
