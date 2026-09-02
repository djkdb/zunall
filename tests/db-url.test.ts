/** DATABASE_URL 정리·점검 단위 테스트. 실행: npx tsx tests/db-url.test.ts */
import { inspectDatabaseUrl, normalizeDatabaseUrl } from "../src/lib/db/url";

let failed = 0;
function check(name: string, condition: boolean, detail = "") {
  console.log(`${condition ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed++;
}

const GOOD = "postgresql://neondb_owner:npg_secret@ep-cool-1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

check("정상 주소는 그대로 통과", inspectDatabaseUrl(GOOD).issues.length === 0);
check("정상 주소의 호스트 접미사", inspectDatabaseUrl(GOOD).hostSuffix === "neon.tech");

check("따옴표로 감싼 값 정리", normalizeDatabaseUrl(`"${GOOD}"`) === GOOD);
check("psql 접두사 제거", normalizeDatabaseUrl(`psql '${GOOD}'`) === GOOD);
check("env 한 줄 통째 붙여넣기 정리", normalizeDatabaseUrl(`DATABASE_URL=${GOOD}`) === GOOD);
check("export 붙은 env 줄 정리", normalizeDatabaseUrl(`export DATABASE_URL="${GOOD}"`) === GOOD);
check("앞뒤 공백/줄바꿈 정리", normalizeDatabaseUrl(`\n  ${GOOD}  \n`) === GOOD);
check("정리했음을 보고", inspectDatabaseUrl(`"${GOOD}"`).cleaned === true);

const brokenCases: Array<[string, string]> = [
  ["빈 값", "   "],
  ["주소가 아닌 값", "my-database-password"],
  ["스킴이 다름", "mysql://user:pw@host/db"],
  ["비밀번호 없음", "postgresql://user@ep-x.aws.neon.tech/neondb"],
  ["DB 이름 없음", "postgresql://user:pw@ep-x.aws.neon.tech"],
  ["예시 문구 그대로", "postgresql://user:<비밀번호>@host/db"],
  ["중간에 줄바꿈", `postgresql://user:pw@host\n/db`],
];
for (const [name, value] of brokenCases) {
  const issues = inspectDatabaseUrl(value).issues;
  check(`문제 감지: ${name}`, issues.length > 0, issues[0]?.slice(0, 40));
}

check("비밀번호가 보고서에 노출되지 않음",
  !JSON.stringify(inspectDatabaseUrl(GOOD)).includes("npg_secret"));

console.log(failed === 0 ? "\n모든 테스트 통과" : `\n${failed}개 실패`);
process.exit(failed === 0 ? 0 : 1);
