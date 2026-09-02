/**
 * Cloudflare Worker 진입점.
 *
 * OpenNext 가 만든 워커(.open-next/worker.js)를 그대로 쓰되, Cron 트리거로 실행되는
 * scheduled 핸들러를 얹는다. 이렇게 해야 앱이 닫혀 있어도 마감 알림을 보낼 수 있다.
 * (스케줄러가 자기 자신의 /api/cron/daily 를 호출하는 구조 — 로직은 앱 안에 둔다)
 */
// @ts-expect-error 빌드 산출물이라 타입 선언이 없다
import openNext from "../.open-next/worker.js";

interface CronEnv {
  APP_URL?: string;
  CRON_KEY?: string;
}

/** Workers 런타임 타입 (별도 타입 패키지 없이 필요한 만큼만 정의) */
interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

type Fetcher = (request: Request, env: unknown, ctx: WorkerContext) => Promise<Response>;

const handler = openNext as { fetch: Fetcher };

export default {
  fetch: handler.fetch,

  async scheduled(_event: unknown, env: CronEnv, ctx: WorkerContext): Promise<void> {
    if (!env.APP_URL || !env.CRON_KEY) {
      console.warn("cron: APP_URL 또는 CRON_KEY 가 없어 건너뜁니다.");
      return;
    }
    const url = `${env.APP_URL.replace(/\/$/, "")}/api/cron/daily?key=${encodeURIComponent(env.CRON_KEY)}`;
    ctx.waitUntil(
      fetch(url)
        .then(async (res) => {
          console.log(`cron: ${res.status} ${await res.text()}`);
        })
        .catch((error) => console.error("cron 실패:", error)),
    );
  },
};

// Durable Object 등 OpenNext 가 내보내는 이름들을 그대로 다시 내보낸다
export * from "../.open-next/worker.js";
