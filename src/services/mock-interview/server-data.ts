import "server-only";
import { setDataLoader } from "./shared/dataLoader";
import { isCloudflareWorkers } from "@/lib/runtime";

/**
 * 질문 은행(직무 7,989개·기업 1,547개)은 2.6MB 라 Worker 번들에 넣지 않고
 * 정적 파일(public/interview-data)로 둔다. 서버는 같은 파일을
 * - Cloudflare Workers: ASSETS 바인딩으로
 * - Node(next start / dev): 디스크에서
 * 읽는다. 한 번 읽은 파일은 dataLoader 가 캐시한다.
 */

const SAFE_PATH = /^(?:roles|companies)\/[a-z0-9_-]+\.json$/;

interface AssetsBinding {
  fetch(input: Request | string): Promise<Response>;
}

/* eslint-disable @typescript-eslint/no-require-imports */
async function readFromAssets(path: string): Promise<unknown> {
  const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  const assets = (env as { ASSETS?: AssetsBinding }).ASSETS;
  if (!assets) throw new Error("ASSETS 바인딩이 없습니다.");
  const res = await assets.fetch(new Request(`https://assets.local/interview-data/${path}`));
  if (!res.ok) throw new Error(`interview-data ${path}: ${res.status}`);
  return res.json();
}

async function readFromDisk(path: string): Promise<unknown> {
  // Workers 번들에 node:fs 가 들어가지 않도록 eval require 로 지연 로드한다 (lib/storage.ts 와 같은 방식).
  const req = eval("require") as NodeRequire;
  const fs = req("node:fs/promises") as typeof import("node:fs/promises");
  const nodePath = req("node:path") as typeof import("node:path");
  const file = nodePath.join(process.cwd(), "public", "interview-data", path);
  return JSON.parse(await fs.readFile(file, "utf8"));
}
/* eslint-enable @typescript-eslint/no-require-imports */

let installed = false;

export function installDataLoader(): void {
  if (installed) return;
  installed = true;
  setDataLoader(async (path) => {
    if (!SAFE_PATH.test(path)) throw new Error(`허용되지 않는 데이터 경로: ${path}`);
    return isCloudflareWorkers() ? readFromAssets(path) : readFromDisk(path);
  });
}
