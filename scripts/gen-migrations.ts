/**
 * migrations/*.sql 을 코드로 묶는다.
 * Cloudflare Workers 에는 파일 시스템이 없으므로, 앱이 스스로 마이그레이션을
 * 적용하려면 SQL 을 번들에 포함해야 한다. 실행: npm run gen:migrations
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const entries = files.map((file) => {
  const sql = fs.readFileSync(path.join(dir, file), "utf-8");
  return `  {\n    name: ${JSON.stringify(file)},\n    sql: ${JSON.stringify(sql)},\n  },`;
});

const out = `// 이 파일은 scripts/gen-migrations.ts 가 만든다. 직접 고치지 말 것.
// migrations/*.sql 을 수정한 뒤 \`npm run gen:migrations\` 를 실행하세요.

export interface BundledMigration {
  name: string;
  sql: string;
}

/** 번호 순서대로 한 번씩 적용된다 (모두 재실행 안전하게 작성되어 있다) */
export const MIGRATIONS: BundledMigration[] = [
${entries.join("\n")}
];
`;

fs.writeFileSync(path.join(process.cwd(), "src/lib/db/migrations.generated.ts"), out);
console.log(`마이그레이션 ${files.length}개를 번들에 포함했습니다: ${files.join(", ")}`);
