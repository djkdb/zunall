import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { databaseKind } from "@/lib/db/info";
import { storageBackend } from "@/lib/storage";
import { REQUIRED_TABLES } from "@/lib/db/ddl";

export const dynamic = "force-dynamic";

/**
 * 배포 상태 진단 엔드포인트.
 * 브라우저에서 /api/health 를 열면 무엇이 빠졌는지 한국어로 알려준다.
 * 접속 문자열·키 같은 비밀값은 절대 노출하지 않는다.
 */
export async function GET() {
  const onWorkers =
    (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ===
    "Cloudflare-Workers";
  const configured = Boolean(process.env.DATABASE_URL);

  const report: {
    ok: boolean;
    runtime: string;
    database: string;
    databaseUrlSet: boolean;
    connected: boolean;
    missingTables: string[];
    storage: string;
    aiProvider: string;
    problems: string[];
  } = {
    ok: false,
    runtime: onWorkers ? "cloudflare-workers" : "node",
    database: databaseKind(),
    databaseUrlSet: configured,
    connected: false,
    missingTables: [],
    storage: storageBackend(),
    aiProvider: process.env.AI_PROVIDER || "mock",
    problems: [],
  };

  if (!configured && onWorkers) {
    report.problems.push(
      "DATABASE_URL 시크릿이 이 Worker에 설정되어 있지 않습니다. " +
        "Cloudflare 대시보드 → 해당 Worker → Settings → Variables and Secrets 에서 " +
        "Secret 으로 추가하세요.",
    );
    return NextResponse.json(report, { status: 503 });
  }

  try {
    const rows = (await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )) as unknown as Array<{ table_name: string }> | { rows?: Array<{ table_name: string }> };
    const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
    const present = new Set(list.map((r) => r.table_name));
    report.connected = true;
    report.missingTables = REQUIRED_TABLES.filter((t) => !present.has(t));
    if (report.missingTables.length > 0) {
      report.problems.push(
        `테이블 ${report.missingTables.length}개가 없습니다. 저장소의 schema.sql 전체를 ` +
          "DB 콘솔(Neon SQL Editor 등)에 붙여넣고 실행하세요.",
      );
    }
  } catch (error) {
    report.problems.push(
      `데이터베이스에 연결하지 못했습니다: ${
        error instanceof Error ? error.message.slice(0, 200) : "알 수 없는 오류"
      }`,
    );
    return NextResponse.json(report, { status: 503 });
  }

  report.ok = report.problems.length === 0;
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
