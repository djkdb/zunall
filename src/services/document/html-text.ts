/**
 * 공고 URL 검증과 HTML→텍스트 변환.
 * 네트워크를 타지 않는 순수 함수만 모아 테스트 가능하게 분리했다.
 * (실제 요청은 fetch-url.ts 담당)
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/** 사설/루프백/링크로컬 주소인지 (IP 리터럴 기준) */
export function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // 클라우드 메타데이터
  return false;
}

/**
 * 사용자가 준 주소로 서버가 요청하므로 SSRF 를 막는다.
 * http/https 만 허용하고 내부망 주소는 거부한다.
 * (Cloudflare Workers 는 global_fetch_strictly_public 플래그로 한 번 더 막힌다)
 */
export function validateNoticeUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "주소 형식이 올바르지 않습니다. https:// 로 시작하는 주소를 넣어주세요." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "http 또는 https 주소만 가져올 수 있습니다." };
  }
  // 로컬 테스트에서만 내부 주소를 허용한다 (운영에서는 설정하지 않음)
  if (process.env.ALLOW_PRIVATE_FETCH !== "1" && isPrivateAddress(url.hostname)) {
    return { error: "내부망 주소는 가져올 수 없습니다." };
  }
  return { url };
}

export function htmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).trim().slice(0, 120) : "";
}

/** 태그를 걷어내고 사람이 읽는 본문만 남긴다 (외부 라이브러리 없이) */
export function htmlToText(html: string): string {
  let out = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(head|nav|footer)[\s\S]*?<\/\1>/gi, " ");

  // 줄바꿈이 의미 있는 블록 태그는 개행으로 바꾼다
  out = out
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/td>\s*<td[^>]*>/gi, " | ");

  out = out.replace(/<[^>]+>/g, " ");
  return normalizeText(decodeEntities(out));
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    middot: "·", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
  };
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => named[name.toLowerCase()] ?? whole);
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
