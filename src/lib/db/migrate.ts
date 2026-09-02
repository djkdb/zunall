import "server-only";
import { sql } from "drizzle-orm";
import { MIGRATIONS } from "./migrations.generated";
import type { AppDb } from "./index";

/**
 * 자동 마이그레이션.
 *
 * 배포 때마다 "SQL 파일을 콘솔에서 실행하세요"를 사람이 기억해야 하는 구조는
 * 실제로 사고를 낸다(시간 컬럼이 INTEGER 로 남아 로그인이 통째로 실패했다).
 * 그래서 앱이 시작할 때 아직 적용되지 않은 마이그레이션만 스스로 실행한다.
 *
 * - 적용 이력은 schema_migrations 테이블에 남긴다
 * - 모든 마이그레이션은 재실행 안전(IF NOT EXISTS / ALTER TYPE)하게 작성한다
 * - 여러 인스턴스가 동시에 떠도 겹치지 않도록 advisory lock 으로 직렬화한다
 */

export interface MigrationStatus {
  applied: string[];
  pending: string[];
  failed: Array<{ name: string; error: string }>;
}

const LOCK_ID = 815_231_701; // 이 앱 전용 임의 상수

async function appliedNames(db: AppDb): Promise<Set<string>> {
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)`,
  );
  const rows = (await db.execute(sql`SELECT name FROM schema_migrations`)) as unknown as
    | Array<{ name: string }>
    | { rows?: Array<{ name: string }> };
  const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
  return new Set(list.map((r) => r.name));
}

/** 아직 적용되지 않은 마이그레이션을 순서대로 실행한다 */
export async function runPendingMigrations(db: AppDb): Promise<MigrationStatus> {
  const status: MigrationStatus = { applied: [], pending: [], failed: [] };
  const done = await appliedNames(db);
  const pending = MIGRATIONS.filter((m) => !done.has(m.name));
  if (pending.length === 0) return status;

  // 동시 실행 방지 (락을 못 잡으면 다른 인스턴스가 처리 중이므로 건너뛴다)
  const lock = (await db.execute(sql`SELECT pg_try_advisory_lock(${LOCK_ID}) AS locked`)) as unknown as
    | Array<{ locked: boolean }>
    | { rows?: Array<{ locked: boolean }> };
  const lockRows = Array.isArray(lock) ? lock : (lock.rows ?? []);
  if (!lockRows[0]?.locked) {
    status.pending = pending.map((m) => m.name);
    return status;
  }

  try {
    for (const migration of pending) {
      try {
        for (const statement of splitStatements(migration.sql)) {
          await db.execute(sql.raw(statement));
        }
        await db.execute(
          sql`INSERT INTO schema_migrations (name, applied_at) VALUES (${migration.name}, ${Date.now()})
              ON CONFLICT (name) DO NOTHING`,
        );
        status.applied.push(migration.name);
      } catch (error) {
        // 하나가 실패해도 나머지는 시도한다 (원인을 한 번에 파악할 수 있도록)
        status.failed.push({
          name: migration.name,
          error: error instanceof Error ? error.message.slice(0, 200) : String(error),
        });
      }
    }
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${LOCK_ID})`);
  }
  return status;
}

/** 적용 상태만 확인 (실행하지 않음) */
export async function migrationStatus(db: AppDb): Promise<{ applied: string[]; pending: string[] }> {
  const done = await appliedNames(db);
  return {
    applied: MIGRATIONS.filter((m) => done.has(m.name)).map((m) => m.name),
    pending: MIGRATIONS.filter((m) => !done.has(m.name)).map((m) => m.name),
  };
}

/** 주석을 제거하고 세미콜론 단위로 나눈다 */
function splitStatements(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
