import "server-only";

/**
 * AI 응답 텍스트에서 JSON 객체를 추출한다.
 * 마크다운 코드펜스, 앞뒤 잡담 텍스트를 허용한다.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // 1) 그대로 파싱 시도
  try {
    return JSON.parse(trimmed);
  } catch {
    // 계속 진행
  }

  // 2) ```json ... ``` 코드펜스 추출
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // 계속 진행
    }
  }

  // 3) 첫 '{'부터 균형 잡힌 마지막 '}'까지 스캔
  const start = trimmed.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("AI 응답에서 유효한 JSON을 찾지 못했습니다.");
}
