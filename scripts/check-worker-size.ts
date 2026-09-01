/**
 * 배포 전에 Worker 번들 크기를 확인한다.
 * Cloudflare는 gzip 기준 무료 3MiB / 유료 10MiB 제한을 두는데, 초과하면
 * 파일 업로드가 모두 끝난 뒤에야 실패한다. wrangler의 dry-run이 계산하는
 * 값이 곧 Cloudflare가 재는 값이므로, 그대로 읽어 미리 막는다.
 */
import { execFileSync } from "node:child_process";

const FREE_LIMIT_KIB = 3 * 1024;

let output: string;
try {
  output = execFileSync("npx", ["wrangler", "deploy", "--dry-run", "--outdir", ".open-next/.size-check"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300_000,
  });
} catch (error) {
  const e = error as { stdout?: string; stderr?: string };
  output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}

const match = output.match(/gzip:\s*([\d.]+)\s*KiB/);
if (!match) {
  console.log("ℹ️  번들 크기를 확인하지 못했습니다 — 배포를 계속합니다.");
  process.exit(0);
}

const gzipKiB = Number(match[1]);
const mb = (kib: number) => `${(kib / 1024).toFixed(2)}MB`;
console.log(`\n📦 Worker 번들 크기(gzip): ${mb(gzipKiB)} / 무료 플랜 한도 3.00MB`);

if (gzipKiB > FREE_LIMIT_KIB) {
  console.error(
    [
      "",
      "❌ 무료 플랜 한도를 넘어 배포가 실패합니다.",
      "",
      "해결 방법:",
      "  1) 무거운 라이브러리를 Node 전용으로 분리하세요 (DEPLOY.md → 번들 크기 참고)",
      "  2) 또는 Workers 유료 플랜($5/월)으로 올리면 한도가 10MB가 됩니다",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (gzipKiB > FREE_LIMIT_KIB * 0.85) {
  console.log("⚠️  한도의 85%를 넘었습니다. 라이브러리를 추가할 때 주의하세요.");
}
console.log("✅ 크기 확인 통과 — 배포를 진행합니다.\n");
