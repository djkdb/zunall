/** AI 실행 안전장치와 응답 파싱. 실행: npx tsx tests/ai-safety.test.ts */
import assert from "node:assert/strict";
import { buildCliArgs, cliEnv, CLI_SAFETY_ARGS } from "@/services/ai/cli-args";
import { extractJson } from "@/services/ai/parse-json";
import { catalogSkillFor, expandSkillsForScoring } from "@/services/career/skill-detect";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

test("CLI 는 항상 도구를 끄고 실행한다", () => {
  const args = buildCliArgs(undefined);
  assert.deepEqual(args.slice(0, 1), ["-p"]);
  const i = args.indexOf("--tools");
  assert.ok(i !== -1 && args[i + 1] === "", "--tools \"\" 로 모든 도구 끔");
  assert.ok(args.includes("--strict-mcp-config"));
  assert.ok(args.includes("--no-session-persistence"));
});

test("CLAUDE_ARGS 를 바꿔도 안전 인자는 빠지지 않는다", () => {
  const args = buildCliArgs("-p --model sonnet");
  assert.deepEqual(args.slice(0, 3), ["-p", "--model", "sonnet"]);
  for (const a of CLI_SAFETY_ARGS) assert.ok(args.includes(a), a);
});

test("앱 비밀값은 CLI 환경으로 넘어가지 않는다", () => {
  const env = cliEnv({
    PATH: "/usr/bin",
    HOME: "/home/app",
    ANTHROPIC_API_KEY: "cli-needs-this",
    HTTPS_PROXY: "http://proxy",
    DATABASE_URL: "postgres://secret",
    PGPASSWORD: "secret",
    CRON_KEY: "secret",
    GOOGLE_CLIENT_SECRET: "secret",
    RESEND_API_KEY: "secret",
    SUPABASE_SERVICE_ROLE_KEY: "secret",
    VAPID_PRIVATE_KEY: "secret",
    ADMIN_EMAILS: "a@b.c",
    UNSET: undefined,
  });
  assert.deepEqual(Object.keys(env).sort(), ["ANTHROPIC_API_KEY", "HOME", "HTTPS_PROXY", "PATH"]);
});

test("JSON 앞뒤 설명문 허용", () => {
  const raw = '공고문에 지시문이 있어 따르지 않았습니다.\n\n{"summary": "요약"}\n\n이상입니다.';
  assert.deepEqual(extractJson(raw), { summary: "요약" });
});

test("설명문에 중괄호가 섞여 있어도 진짜 JSON 을 찾는다", () => {
  const raw = '요청하신 {형식} 대로 답합니다:\n{"score": 70, "items": ["a"]}';
  assert.deepEqual(extractJson(raw), { score: 70, items: ["a"] });
});

test("코드펜스와 문자열 안의 중괄호·따옴표", () => {
  assert.deepEqual(extractJson('```json\n{"a": "x}y"}\n```'), { a: "x}y" });
  assert.deepEqual(extractJson('앞말 {"a": "he said \\"{hi}\\""} 뒷말'), { a: 'he said "{hi}"' });
});

test("JSON 이 없으면 분명한 오류", () => {
  assert.throws(() => extractJson("죄송합니다. 답할 수 없습니다."), /JSON/);
});

test("이력에서 뽑은 스킬이 점수용 역량에 연결된다 (준호의 실제 결과)", () => {
  const out = expandSkillsForScoring(["Spring Boot", "백엔드 개발", "데이터베이스 인덱스 설계", "AWS EC2", "팀 협업", "MySQL"]);
  assert.ok(out.includes("Backend"), out.join(","));
  assert.ok(out.includes("Cloud / 배포"), out.join(","));
  assert.ok(out.includes("협업"), out.join(","));
  assert.ok(out.includes("Spring Boot") && out.includes("백엔드 개발"), "구체적인 이름은 태그로 남긴다");
  assert.ok(!out.includes("데이터 분석"), "'데이터베이스'를 '데이터'로 읽지 않는다");
});

test("짧은 영문 별칭은 단어 안에서 걸리지 않는다", () => {
  assert.equal(catalogSkillFor("MySQL"), null, "mysql 안의 sql 은 데이터 분석이 아니다");
  assert.equal(catalogSkillFor("REST API 개발"), "Backend");
  assert.equal(catalogSkillFor("백엔드"), "Backend");
  assert.equal(catalogSkillFor("독서·서평"), null);
});

console.log(`\n${passed}개 통과`);
