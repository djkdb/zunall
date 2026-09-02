import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { databaseKind } from "@/lib/db/info";
import { storageBackend } from "@/lib/storage";
import { REQUIRED_TABLES } from "@/lib/db/ddl";
import { inspectDatabaseUrl } from "@/lib/db/url";
import { getProviderName, providerFallbackReason } from "@/services/ai/provider";
import { isCloudflareWorkers } from "@/lib/runtime";
import { callbackUrl, googleConfigReport } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/**
 * 배포 상태 진단 엔드포인트.
 * 브라우저에서 /api/health 를 열면 무엇이 빠졌는지 한국어로 알려준다.
 * 접속 문자열·키 같은 비밀값은 절대 노출하지 않는다.
 */
export async function GET(request: Request) {
  const onWorkers = isCloudflareWorkers();
  const configured = Boolean(process.env.DATABASE_URL);

  const report: {
    ok: boolean;
    runtime: string;
    database: string;
    databaseUrlSet: boolean;
    connected: boolean;
    databaseUrl?: {
      scheme: string | null;
      hostSuffix: string | null;
      hasCredentials: boolean;
      cleaned: boolean;
      issues: string[];
    };
    missingTables: string[];
    missingColumns: string[];
    storage: string;
    aiProvider: string;
    problems: string[];
    notices: string[];
    google: {
      enabled: boolean;
      clientIdSet: boolean;
      clientIdLooksValid: boolean;
      clientSecretSet: boolean;
      redirectUriOverride: string | null;
      redirectUri: string;
    };
  } = {
    ok: false,
    runtime: onWorkers ? "cloudflare-workers" : "node",
    database: databaseKind(),
    databaseUrlSet: configured,
    connected: false,
    missingTables: [],
    missingColumns: [],
    storage: storageBackend(),
    aiProvider: getProviderName(),
    problems: [],
    notices: [],
    google: {
      ...googleConfigReport(),
      // 콘솔의 "승인된 리디렉션 URI" 에 이 값을 그대로 넣어야 한다
      redirectUri: callbackUrl(request.url, request.headers),
    },
  };

  if (report.google.enabled && !report.google.clientIdLooksValid) {
    report.notices.push(
      "GOOGLE_CLIENT_ID 가 '...apps.googleusercontent.com' 형태가 아닙니다. 값을 다시 확인해주세요.",
    );
  }

  const aiNotice = providerFallbackReason();
  if (aiNotice) report.notices.push(aiNotice);

  if (configured) {
    const inspection = inspectDatabaseUrl(process.env.DATABASE_URL!);
    report.databaseUrl = inspection;
    if (inspection.issues.length > 0) {
      report.problems.push(
        `DATABASE_URL 값에 문제가 있습니다: ${inspection.issues.join(" / ")}`,
      );
      return NextResponse.json(report, { status: 503 });
    }
  }

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

    // 나중에 추가된 컬럼(구글 로그인 등)은 테이블이 있어도 빠져 있을 수 있다
    const colRows = (await db.execute(
      sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    )) as unknown as
      | Array<{ table_name: string; column_name: string }>
      | { rows?: Array<{ table_name: string; column_name: string }> };
    const colList = Array.isArray(colRows) ? colRows : (colRows.rows ?? []);
    const columns = new Set(colList.map((c) => `${c.table_name}.${c.column_name}`));
    const REQUIRED_COLUMNS = ["users.google_id", "users.avatar_url"];
    report.missingColumns = REQUIRED_COLUMNS.filter((c) => !columns.has(c));
    if (report.missingColumns.length > 0) {
      report.problems.push(
        `컬럼이 빠져 있습니다: ${report.missingColumns.join(", ")}. ` +
          "저장소의 migrations/001-google-login.sql 을 DB 콘솔에서 실행하세요. " +
          "(구글 로그인이 '실패했습니다'로 끝나는 원인입니다)",
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
