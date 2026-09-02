/** 마이그레이션 SQL 분리기 테스트. 실행: npx tsx tests/migrate-split.test.ts */
import { splitStatements } from "../src/lib/db/sql-split";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

check("주석 제거", splitStatements("-- 설명\nSELECT 1;").length === 1);
check("여러 문장 분리", splitStatements("SELECT 1; SELECT 2;").length === 2);
check("끝 세미콜론 없어도 처리", splitStatements("SELECT 1").length === 1);

const doBlock = `DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT 1 LOOP
    EXECUTE format('ALTER TABLE %I', r);
  END LOOP;
END
$$;
ALTER TABLE users ALTER COLUMN created_at TYPE BIGINT;`;
const parts = splitStatements(doBlock);
check("DO 블록을 통째로 유지", parts.length === 2, `${parts.length}개`);
check("DO 블록 안의 세미콜론 보존", parts[0].includes("END LOOP;") && parts[0].includes("EXECUTE format"));
check("DO 블록 뒤 문장도 분리", parts[1].startsWith("ALTER TABLE users"));

console.log(failed === 0 ? "\n모든 테스트 통과" : `\n${failed}개 실패`);
process.exit(failed === 0 ? 0 : 1);
