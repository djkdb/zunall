import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIRequest } from "./provider";

/**
 * Anthropic API 기반 provider (AI_PROVIDER=anthropic).
 * Claude CLI가 없는 서버/서버리스 배포 환경(Cloudflare, Docker 등)용.
 * ANTHROPIC_API_KEY 환경변수로 인증한다.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  async complete(request: AIRequest): Promise<string> {
    const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용
    const model = request.model || process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

    try {
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          // 공고 정리·첨삭·채점 모두 깊은 추론보다 꼼꼼한 읽기가 필요한 일이다.
          // 기본값에 맡기지 않고 명시한다 (모델마다 기본값이 다르다).
          output_config: { effort: request.effort ?? "medium" },
          // 안전 분류기가 요청을 거절하면 같은 요청을 권장 대체 모델로 서버에서 다시 실행한다.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // 같은 면접 안에서는 지시문이 그대로라 캐시해 두고 다시 쓴다 (비용·지연 절감)
          ...(request.system
            ? { system: [{ type: "text" as const, text: request.system, cache_control: { type: "ephemeral" as const } }] }
            : {}),
          messages: [{ role: "user", content: request.prompt }],
        },
        request.timeoutMs ? { timeout: request.timeoutMs, maxRetries: 1 } : undefined,
      );

      if (response.stop_reason === "refusal") {
        throw new Error("AI가 이 요청 처리를 거절했습니다. 문서 내용을 확인해주세요.");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("AI 응답이 너무 길어 중간에 끊겼습니다. 문서를 나눠서 다시 시도해주세요.");
      }

      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      if (!text.trim()) {
        throw new Error("AI 응답이 비어 있습니다.");
      }
      return text;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error(
          "Anthropic API 인증에 실패했습니다. ANTHROPIC_API_KEY 환경변수를 확인해주세요.",
        );
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error("Anthropic API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.");
      }
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API 오류 (${error.status}): ${error.message.slice(0, 200)}`);
      }
      throw error;
    }
  }
}
