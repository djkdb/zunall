/**
 * Cloudflare + Supabase 배포 전 설정 점검.
 * `npm run deploy:cf` 실행 시 자동으로 먼저 돌며, 흔한 실수를 한국어로 알려준다.
 * (Cloudflare secret 은 로컬에서 읽을 수 없으므로, 등록 여부는 안내로만 확인한다)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const problems: string[] = [];
const notices: string[] = [];
const root = process.cwd();

// 1) 배포 도구 설치 확인
if (!fs.existsSync(path.join(root, "node_modules", "@opennextjs", "cloudflare"))) {
  problems.push("배포 도구가 설치되지 않았습니다. 먼저 `npm install` 을 실행하세요.");
}

// 2) wrangler 설정 확인
const wranglerPath = path.join(root, "wrangler.jsonc");
if (!fs.existsSync(wranglerPath)) {
  problems.push("wrangler.jsonc 파일이 없습니다. 저장소를 다시 pull 해주세요.");
} else {
  const raw = fs.readFileSync(wranglerPath, "utf-8");
  if (raw.includes("REPLACE_WITH")) {
    problems.push("wrangler.jsonc 에 아직 채우지 않은 placeholder 가 있습니다.");
  }
}

// 3) 스키마 파일 확인 (Supabase에 적용해야 함)
if (!fs.existsSync(path.join(root, "schema.sql"))) {
  notices.push(
    [
      "schema.sql 이 없습니다. Supabase에 테이블을 아직 만들지 않았다면:",
      "  npx tsx scripts/export-schema.ts",
      "  → 생성된 schema.sql 내용을 Supabase 대시보드 SQL Editor 에 붙여넣고 실행",
    ].join("\n"),
  );
}

// 4) Cloudflare secret 등록 여부 (로그인 상태일 때만 확인 가능)
const REQUIRED_SECRETS = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
try {
  const out = execFileSync("npx", ["wrangler", "secret", "list"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 60_000,
  });
  const registered = new Set<string>(
    (JSON.parse(out) as Array<{ name: string }>).map((s) => s.name),
  );
  const missing = REQUIRED_SECRETS.filter((name) => !registered.has(name));
  if (missing.length > 0) {
    problems.push(
      [
        `Cloudflare secret 이 등록되지 않았습니다: ${missing.join(", ")}`,
        ...missing.map((name) => `  npx wrangler secret put ${name}`),
        "  (실행하면 값을 입력하라는 프롬프트가 뜹니다)",
      ].join("\n"),
    );
  }
  if (!registered.has("ANTHROPIC_API_KEY")) {
    notices.push(
      "ANTHROPIC_API_KEY 가 없습니다 — AI 기능이 mock(휴리스틱)으로 동작합니다.\n" +
        "  실제 Claude 를 쓰려면: npx wrangler secret put ANTHROPIC_API_KEY",
    );
  }
} catch {
  notices.push(
    "Cloudflare secret 목록을 확인하지 못했습니다 (로그인 전이거나 Worker 미생성).\n" +
      "  아직 로그인하지 않았다면: npx wrangler login",
  );
}

if (notices.length > 0) {
  console.log("\n⚠️  확인이 필요합니다\n");
  for (const n of notices) console.log(n + "\n");
}

if (problems.length > 0) {
  console.error("\n❌ 배포를 시작할 수 없습니다\n");
  for (const p of problems) console.error(p + "\n");
  console.error("자세한 절차는 DEPLOY.md 를 참고하세요.\n");
  process.exit(1);
}

console.log("✅ 배포 설정 점검 완료 — 빌드를 시작합니다.\n");
