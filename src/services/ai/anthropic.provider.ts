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
    const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 16000,
        messages: [{ role: "user", content: request.prompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("AI가 이 요청 처리를 거절했습니다. 문서 내용을 확인해주세요.");
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
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
