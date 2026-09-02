/** 실행 환경 판별 (Cloudflare Workers 인지). 여러 곳에서 같은 판정을 쓰기 위해 한 곳에 둔다. */
export function isCloudflareWorkers(): boolean {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent === "Cloudflare-Workers";
}
