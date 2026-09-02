import "server-only";
import { htmlTitle, htmlToText, normalizeText, validateNoticeUrl } from "./html-text";

/**
 * 공고 URL 을 받아 본문 텍스트로 바꾼다.
 * 주소 검증(SSRF 차단)은 html-text.ts 의 validateNoticeUrl 이 담당하고,
 * 여기서는 크기·시간 제한과 콘텐츠 형식만 지킨다.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

export interface FetchedNotice {
  ok: boolean;
  title: string;
  text: string;
  error?: string;
}

export async function fetchNotice(raw: string): Promise<FetchedNotice> {
  const checked = validateNoticeUrl(raw);
  if ("error" in checked) return { ok: false, title: "", text: "", error: checked.error };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(checked.url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // 일부 사이트가 기본 UA 를 막으므로 일반 브라우저처럼 요청한다
        "user-agent": "Mozilla/5.0 (compatible; CaveroBot/1.0; +https://github.com/djkdb/zunall)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        "accept-language": "ko,en;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        title: "",
        text: "",
        error: `페이지를 가져오지 못했습니다 (HTTP ${response.status}). 로그인이 필요한 공고일 수 있습니다.`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      return {
        ok: false,
        title: "",
        text: "",
        error: `웹페이지가 아닙니다 (${contentType.split(";")[0] || "형식 불명"}). 파일이면 업로드를 이용해주세요.`,
      };
    }

    const body = await readCapped(response);
    const isHtml = /html/i.test(contentType);
    const text = isHtml ? htmlToText(body) : normalizeText(body);
    if (text.replace(/\s/g, "").length < 50) {
      return {
        ok: false,
        title: "",
        text: "",
        error:
          "본문을 거의 읽지 못했습니다. 자바스크립트로 그려지는 페이지일 수 있으니, 공고 내용을 복사해 붙여넣거나 파일로 올려주세요.",
      };
    }
    return { ok: true, title: isHtml ? htmlTitle(body) : "", text };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      title: "",
      text: "",
      error: aborted
        ? "페이지 응답이 너무 느려 중단했습니다."
        : "페이지를 가져오지 못했습니다. 주소를 확인해주세요.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 응답을 최대 MAX_BYTES 까지만 읽는다 */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    chunks.push(value);
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}
