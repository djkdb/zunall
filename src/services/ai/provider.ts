import "server-only";
import type { AIAction } from "@/lib/constants";
import { isCloudflareWorkers } from "@/lib/runtime";

/** AI 실행 요청. prompt는 실제 LLM용, context는 mock provider가 활용한다. */
export interface AIRequest {
  action: AIAction | "mock_interview";
  prompt: string;
  context: AIContext;
  /**
   * 바뀌지 않는 지시문 (모의 면접처럼 같은 지시로 여러 번 부를 때).
   * API 에서는 캐시해 두고 재사용하고, CLI 에서는 prompt 앞에 붙인다.
   */
  system?: string;
  /** 생각을 얼마나 깊게 할지. 면접 문답처럼 기다림이 중요한 호출은 low */
  effort?: "low" | "medium";
  /** 이 호출에만 쓸 모델 (없으면 기본 모델) */
  model?: string;
  /** 이 호출의 시간 제한 (ms) */
  timeoutMs?: number;
}

/** context 가 필요 없는 호출(모의 면접 등)에 넘기는 빈 값 */
export const EMPTY_AI_CONTEXT: AIContext = {
  activityName: "",
  activityType: "etc",
  organizer: null,
  criteria: [],
  announcementText: "",
  submissionText: "",
  submissionTitle: null,
  userProfile: "",
};

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
