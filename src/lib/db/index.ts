import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { cache } from "react";
import * as schema from "./schema";
import { BOOTSTRAP_DDL } from "./ddl";
import { normalizeDatabaseUrl } from "./url";

/**
 * PostgreSQL 단일 다이얼렉트 DB 레이어.
 *
 * - `DATABASE_URL` 이 있으면 postgres.js 로 접속 (Supabase / 로컬 Postgres / Workers)
 * - 없으면 PGlite(WASM 내장 Postgres)로 폴백 — 설치 없이 로컬 개발 가능
 *
 * ⚠️ Cloudflare Workers 제약:
 * Workers 런타임은 한 요청에서 만든 소켓을 다른 요청에서 재사용하는 것을 금지한다
 * (재사용 시 "Worker's code had hung" 오류). 따라서 Workers에서는 커넥션을
 * 모듈 전역에 캐시하지 않고 **요청 단위**로 만든다. React `cache()` 가 요청 범위
 * 메모이제이션을 제공하므로 한 요청 안의 모든 쿼리는 커넥션 하나를 공유한다.
 * (Supabase Transaction pooler 또는 Cloudflare Hyperdrive 사용을 권장)
 */
export type AppDb = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __caveroDb?: AppDb;
  __caveroReady?: Promise<void>;
};

/** 앞뒤 군더더기를 걷어낸 접속 문자열. 미설정이면 undefined */
export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const normalized = normalizeDatabaseUrl(raw);
  return normalized || undefined;
}

function isCloudflareWorkers(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === "Cloudflare-Workers";
}

/**
 * Neon HTTP 드라이버 사용 여부.
 * Neon(neon.tech) + Workers 조합에서는 TCP/TLS 대신 순수 fetch 로 동작하는
 * HTTP 드라이버가 가장 안전하고 빠르다. DB_DRIVER 로 강제 지정할 수 있다.
 *   DB_DRIVER=neon-http   → 항상 HTTP 드라이버
 *   DB_DRIVER=postgres-js → 항상 TCP 드라이버 (문제 발생 시 폴백용)
 */
function useNeonHttp(url: string, workers: boolean): boolean {
  const forced = process.env.DB_DRIVER;
  if (forced === "neon-http") return true;
  if (forced === "postgres-js") return false;
  return workers && /(^|[@.])neon\.tech/.test(url);
}

function createNeonHttpDb(url: string): AppDb {
  return drizzleNeonHttp(neon(url), { schema }) as unknown as AppDb;
}

function createPostgresDb(url: string, workers: boolean): AppDb {
  // Supabase 트랜잭션 풀러(6543) 및 서버리스 환경 대응:
  // prepared statement 비활성화, 커넥션 수 최소화.
  const client = postgres(url, {
    prepare: false,
    max: workers ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return drizzlePostgres(client, { schema }) as unknown as AppDb;
}

function createPgliteDb(): AppDb {
  // PGlite는 Node 전용(WASM + 파일시스템). Workers 번들에 포함되지 않도록
  // 번들러가 정적 분석할 수 없는 eval require 로 로드한다.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const req = eval("require") as NodeRequire;
  const path = req("node:path") as typeof import("node:path");
  const { PGlite } = req("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = req("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const dataDir = process.env.PGLITE_PATH || path.join(process.cwd(), "data", "pg");
  const client = new PGlite(dataDir);
  return drizzlePglite(client, { schema }) as unknown as AppDb;
}

/**
 * 요청 범위 DB 인스턴스 (Workers 전용).
 * React cache() 는 요청 단위로 메모이즈되므로, 한 요청 내에서는 같은 커넥션을 쓰고
 * 요청이 끝나면 인스턴스가 버려진다 = 요청 간 소켓 재사용이 발생하지 않는다.
 */
const requestScopedDb = cache((): AppDb => {
  const url = databaseUrl()!;
  // HTTP 드라이버는 상태를 갖지 않으므로 요청 간 재사용 문제가 없지만,
  // 일관성을 위해 동일한 요청 범위 경로를 사용한다.
  return useNeonHttp(url, true) ? createNeonHttpDb(url) : createPostgresDb(url, true);
});

function resolveDb(): AppDb {
  const url = databaseUrl();

  if (isCloudflareWorkers()) {
    if (!url) {
      // PGlite는 Workers에서 동작하지 않으므로, 원인을 알 수 없는 크래시 대신
      // 무엇을 해야 하는지 알려주고 멈춘다.
      throw new Error(
        "DATABASE_URL 시크릿이 설정되지 않았습니다. Cloudflare 대시보드 → 해당 Worker → " +
          "Settings → Variables and Secrets 에서 Secret 으로 추가한 뒤 다시 시도하세요. " +
          "(상태 확인: /api/health)",
      );
    }
    return requestScopedDb();
  }

  if (!globalForDb.__caveroDb) {
    globalForDb.__caveroDb = url ? createPostgresDb(url, false) : createPgliteDb();
  }
  return globalForDb.__caveroDb;
}

/**
 * 스키마 부트스트랩.
 * - PGlite(로컬): 항상 DDL 실행 (CREATE TABLE IF NOT EXISTS 라 안전)
 * - Postgres: 관리형 DB(Supabase)는 schema.sql 을 1회 적용하는 것이 원칙이므로
 *   자동 실행하지 않는다. 로컬 개발/테스트 편의를 위해 DB_AUTO_MIGRATE=1 일 때만 실행.
 */
async function ensureSchema(): Promise<void> {
  const url = databaseUrl();
  const shouldRun = !url || process.env.DB_AUTO_MIGRATE === "1";
  if (!shouldRun) return;
  const database = resolveDb();
  for (const statement of BOOTSTRAP_DDL.split(";")) {
    const sql = statement.trim();
    if (!sql) continue;
    await database.execute(sql);
  }
}

/** 첫 쿼리 전에 스키마를 보장한다 (프로세스당 1회). */
function ready(): Promise<void> {
  if (!globalForDb.__caveroReady) {
    globalForDb.__caveroReady = ensureSchema().catch((error) => {
      // 실패해도 다음 요청에서 다시 시도할 수 있도록 캐시를 비운다.
      globalForDb.__caveroReady = undefined;
      throw error;
    });
  }
  return globalForDb.__caveroReady;
}

/**
 * 지연 초기화 Proxy.
 * 쿼리 빌더 호출을 가로채 스키마 준비가 끝난 뒤 실행되도록 보장한다.
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    const real = resolveDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop as string];
    if (typeof value !== "function") return value;

    const method = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => {
      const builder = method.apply(real, args);
      // drizzle 쿼리 빌더는 thenable — then을 감싸 스키마 준비를 선행시킨다.
      if (builder && typeof (builder as PromiseLike<unknown>).then === "function") {
        return wrapThenable(builder as PromiseLike<unknown> & Record<string, unknown>);
      }
      return builder;
    };
  },
});

/** 빌더의 체이닝 메서드를 유지하면서 then만 가로채는 래퍼 */
function wrapThenable<T extends PromiseLike<unknown> & Record<string, unknown>>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          ready().then(() => target).then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const next = (value as (...a: unknown[]) => unknown).apply(target, args);
        if (next && typeof (next as PromiseLike<unknown>).then === "function") {
          return wrapThenable(next as T);
        }
        return next;
      };
    },
  });
}

export * from "./schema";
