import "server-only";
import type { AIAction } from "@/lib/constants";
import { isCloudflareWorkers } from "@/lib/runtime";

/** AI 실행 요청. prompt는 실제 LLM용, context는 mock provider가 활용한다. */
export interface AIRequest {
  action: AIAction;
  prompt: string;
  context: AIContext;
}

export interface AIContext {
  activityName: string;
  activityType: string;
  organizer: string | null;
  criteria: Array<{ name: string; weight: number; source: string; description?: string | null }>;
  announcementText: string;
  submissionText: string;
  submissionTitle: string | null;
  userProfile: string;
  extraInstruction?: string;
}

export interface AIProvider {
  readonly name: string;
  /** JSON 문자열(또는 JSON을 포함한 텍스트)을 반환한다 */
  complete(request: AIRequest): Promise<string>;
}

/**
 * 실제로 실행 가능한 provider 이름.
 * 설정만 보고 고르면 배포 환경에서 "키가 없다" 같은 오류로 기능 전체가 죽으므로,
 * 쓸 수 없는 경우에는 조용히 mock(휴리스틱 분석)으로 내려간다.
 */
export function getProviderName(): string {
  const value = process.env.AI_PROVIDER;
  if (value === "anthropic") {
    return process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock";
  }
  if (value === "claude") {
    // Claude CLI 는 프로세스 실행이 필요해 Workers 에서는 쓸 수 없다
    return isCloudflareWorkers() ? "mock" : "claude";
  }
  return "mock";
}

/** 설정값과 실제 동작이 다른 이유 (설정 화면 안내용). 없으면 null */
export function providerFallbackReason(): string | null {
  const value = process.env.AI_PROVIDER;
  if (value === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return "ANTHROPIC_API_KEY 가 없어 mock(휴리스틱 분석)으로 동작 중입니다.";
  }
  if (value === "claude" && isCloudflareWorkers()) {
    return "Cloudflare Workers 에서는 Claude CLI 를 실행할 수 없어 mock 으로 동작 중입니다.";
  }
  return null;
}

export async function getProvider(): Promise<AIProvider> {
  switch (getProviderName()) {
    case "claude": {
      const { ClaudeCliProvider } = await import("./claude-cli.provider");
      return new ClaudeCliProvider();
    }
    case "anthropic": {
      const { AnthropicProvider } = await import("./anthropic.provider");
      return new AnthropicProvider();
    }
    default: {
      const { MockProvider } = await import("./mock.provider");
      return new MockProvider();
    }
  }
}
