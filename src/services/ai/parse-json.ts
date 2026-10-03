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

  // 3) '{' 마다 균형 잡힌 '}' 까지 잘라 파싱해 본다.
  //    앞에 붙은 설명문에 중괄호가 섞여 있어도("{...} 형식으로 답합니다") 다음 후보로 넘어간다.
  for (let start = trimmed.indexOf("{"); start !== -1; start = trimmed.indexOf("{", start + 1)) {
    const candidate = balancedObjectAt(trimmed, start);
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object") return value;
    } catch {
      // 다음 후보
    }
  }

  throw new Error("AI 응답에서 유효한 JSON을 찾지 못했습니다.");
}

/** start 위치의 '{' 와 짝이 맞는 '}' 까지의 문자열 (짝이 없으면 null) */
function balancedObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
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
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
