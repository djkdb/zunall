import "server-only";
import type { AIAction } from "@/lib/constants";

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

export function getProviderName(): string {
  const value = process.env.AI_PROVIDER;
  if (value === "claude" || value === "anthropic") return value;
  return "mock";
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
