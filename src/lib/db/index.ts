import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { BOOTSTRAP_DDL } from "./ddl";

// Next.js dev(HMR) 환경에서 커넥션이 중복 생성되지 않도록 globalThis에 싱글턴 유지.
const globalForDb = globalThis as unknown as {
  __zunallDb?: BetterSQLite3Database<typeof schema>;
};

function createDb(): BetterSQLite3Database<typeof schema> {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "zunall.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(BOOTSTRAP_DDL);

  return drizzle(sqlite, { schema });
}

export const db = globalForDb.__zunallDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__zunallDb = db;
}

export * from "./schema";
