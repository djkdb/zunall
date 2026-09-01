import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleD1, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";
import { BOOTSTRAP_DDL } from "./ddl";

/**
 * 이중 드라이버 DB 레이어:
 * - 로컬/Node 배포: better-sqlite3 (동기 드라이버지만 drizzle 쿼리는 thenable이라 await 가능)
 * - Cloudflare Workers: D1 바인딩 (비동기 전용)
 *
 * 전체 코드는 async(D1) 타입으로 통일한다 — 모든 호출부는 반드시 await 한다.
 */
export type AppDb = DrizzleD1Database<typeof schema>;

/** Cloudflare Workers 런타임 감지 (workerd는 navigator.userAgent를 고정값으로 설정) */
function isCloudflareWorkers(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === "Cloudflare-Workers";
}

interface D1BindingEnv {
  DB?: unknown;
}

const globalForDb = globalThis as unknown as { __zunallDb?: AppDb };

function createLocalDb(): AppDb {
  // better-sqlite3는 네이티브 모듈이라 Workers 번들에 포함되면 안 된다.
  // 번들러가 정적 분석하지 못하도록 eval require를 사용한다 (Node 경로에서만 실행됨).
  /* eslint-disable @typescript-eslint/no-require-imports */
  const req = eval("require") as NodeRequire;
  const fs = req("node:fs") as typeof import("node:fs");
  const path = req("node:path") as typeof import("node:path");
  const Database = req("better-sqlite3") as typeof import("better-sqlite3");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "zunall.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(BOOTSTRAP_DDL);

  // 동기 드라이버 인스턴스를 async 타입으로 노출 — 쿼리 빌더 API는 동일하고
  // await는 동기 결과도 그대로 통과시키므로 안전하다.
  return drizzleSqlite(sqlite, { schema }) as unknown as AppDb;
}

function resolveDb(): AppDb {
  if (isCloudflareWorkers()) {
    // D1 바인딩은 요청 컨텍스트에서 가져온다 (캐시하지 않음)
    const { env } = getCloudflareContext();
    const binding = (env as D1BindingEnv).DB;
    if (!binding) {
      throw new Error(
        "D1 바인딩 'DB'를 찾을 수 없습니다. wrangler 설정의 d1_databases를 확인하세요. " +
          "스키마는 `wrangler d1 execute <name> --file=schema.sql`로 적용해야 합니다.",
      );
    }
    return drizzleD1(binding as Parameters<typeof drizzleD1>[0], { schema });
  }

  if (!globalForDb.__zunallDb) {
    globalForDb.__zunallDb = createLocalDb();
  }
  return globalForDb.__zunallDb;
}

/**
 * 지연 해석 Proxy: 접근 시점에 런타임에 맞는 실제 인스턴스로 위임한다.
 * (Workers에서는 요청 시점에만 바인딩을 얻을 수 있기 때문)
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    const real = resolveDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop as string];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});

export * from "./schema";
