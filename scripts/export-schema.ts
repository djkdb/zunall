/**
 * D1 마이그레이션용 스키마 파일 생성.
 * 실행: npx tsx scripts/export-schema.ts  → ./schema.sql
 * 적용: npx wrangler d1 execute cavero --remote --file=schema.sql
 */
import fs from "node:fs";
import path from "node:path";
import { BOOTSTRAP_DDL } from "../src/lib/db/ddl";

const out = path.join(process.cwd(), "schema.sql");
fs.writeFileSync(out, `-- Cavero schema (generated from src/lib/db/ddl.ts)\n${BOOTSTRAP_DDL.trim()}\n`);
console.log(`schema.sql 생성 완료 (${BOOTSTRAP_DDL.trim().split("CREATE TABLE").length - 1}개 테이블)`);
