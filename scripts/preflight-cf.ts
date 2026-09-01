/**
 * Cloudflare 배포 전 설정 점검.
 * `npm run deploy:cf` 실행 시 자동으로 먼저 돌며, 흔한 실수를 한국어로 알려준다.
 */
import fs from "node:fs";
import path from "node:path";

const problems: string[] = [];
const warnings: string[] = [];

const root = process.cwd();
const wranglerPath = path.join(root, "wrangler.jsonc");

if (!fs.existsSync(wranglerPath)) {
  problems.push("wrangler.jsonc 파일이 없습니다. 저장소를 다시 pull 해주세요.");
} else {
  const raw = fs.readFileSync(wranglerPath, "utf-8");

  if (raw.includes("REPLACE_WITH_D1_DATABASE_ID")) {
    problems.push(
      [
        "wrangler.jsonc의 database_id가 아직 채워지지 않았습니다.",
        "  1) npx wrangler d1 create zunall",
        "  2) 출력에 나오는 database_id (UUID) 를 복사",
        '  3) wrangler.jsonc 의 "REPLACE_WITH_D1_DATABASE_ID" 자리에 붙여넣고 저장',
      ].join("\n"),
    );
  }

  if (!/"bucket_name"\s*:\s*"[^"]+"/.test(raw)) {
    problems.push("wrangler.jsonc에 R2 bucket_name이 설정되어 있지 않습니다.");
  }
}

if (!fs.existsSync(path.join(root, "schema.sql"))) {
  warnings.push(
    [
      "schema.sql 이 없습니다. D1에 테이블을 아직 만들지 않았다면 아래를 먼저 실행하세요:",
      "  npx tsx scripts/export-schema.ts",
      "  npx wrangler d1 execute zunall --remote --file=schema.sql",
    ].join("\n"),
  );
}

if (!fs.existsSync(path.join(root, "node_modules", "@opennextjs", "cloudflare"))) {
  problems.push("배포 도구가 설치되지 않았습니다. 먼저 `npm install` 을 실행하세요.");
}

if (warnings.length > 0) {
  console.log("\n⚠️  확인이 필요합니다\n");
  for (const w of warnings) console.log(w + "\n");
}

if (problems.length > 0) {
  console.error("\n❌ 배포를 시작할 수 없습니다\n");
  for (const p of problems) console.error(p + "\n");
  console.error("자세한 절차는 DEPLOY.md 의 '경로 B' 섹션을 참고하세요.\n");
  process.exit(1);
}

console.log("✅ 배포 설정 점검 완료 — 빌드를 시작합니다.\n");
