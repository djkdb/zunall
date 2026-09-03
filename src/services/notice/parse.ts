/**
 * 공고 목록 페이지에서 개별 공고 링크를 뽑아낸다 (순수 함수).
 *
 * 사이트마다 구조가 달라 완벽할 수 없으므로, "링크 텍스트가 제목처럼 보이는가"
 * 라는 한 가지 기준으로 거른다. 남는 잡음은 사용자가 키워드로 좁힌다.
 */

export interface ParsedNotice {
  title: string;
  url: string;
  publishedAt?: string;
}

/** 목록·메뉴에서 흔히 보이는, 공고 제목일 리 없는 문구 */
const NAVIGATION_WORDS = [
  "로그인", "회원가입", "마이페이지", "장바구니", "고객센터", "이용약관", "개인정보",
  "홈으로", "메인", "목록", "더보기", "더 보기", "다음", "이전", "처음", "맨끝", "맨 끝",
  "검색", "전체보기", "전체 보기", "바로가기", "바로 가기", "사이트맵", "공지사항 전체",
  "top", "home", "login", "search", "next", "prev", "more",
];

/** 제목처럼 보이는가 — 너무 짧거나 메뉴 문구면 버린다 */
export function looksLikeTitle(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6 || trimmed.length > 200) return false;
  if (/^[\d\s.\-/]+$/.test(trimmed)) return false; // 숫자·날짜만 있는 링크(페이지 번호 등)
  const lower = trimmed.toLowerCase();
  if (NAVIGATION_WORDS.some((word) => lower === word || lower === `${word} >`)) return false;
  return true;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function cleanText(html: string): string {
  // CDATA 는 태그 제거보다 먼저 벗겨낸다 (통째로 지워져 제목이 사라지는 것을 막는다)
  const unwrapped = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeEntities(unwrapped.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** RSS / Atom 피드에서 항목을 뽑는다 */
export function parseFeed(xml: string, baseUrl: string): ParsedNotice[] {
  const results: ParsedNotice[] = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];

  for (const block of blocks) {
    const title = cleanText(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

    // RSS 는 <link>주소</link>, Atom 은 <link href="주소" />
    const linkText = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    const linkHref = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1];
    const raw = linkText || linkHref;
    if (!title || !raw) continue;

    const url = absolute(raw, baseUrl);
    if (!url) continue;

    const published =
      block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      block.match(/<updated\b[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
      block.match(/<published\b[^>]*>([\s\S]*?)<\/published>/i)?.[1];

    results.push({
      title: title.trim(),
      url,
      publishedAt: published ? toDateStr(published.trim()) : undefined,
    });
  }
  return results;
}

/** 일반 HTML 목록 페이지에서 링크를 뽑는다 */
export function parseLinks(html: string, baseUrl: string): ParsedNotice[] {
  const results: ParsedNotice[] = [];
  const seen = new Set<string>();
  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return results;
  }

  for (const match of anchors) {
    const href = match[1];
    const title = cleanText(match[2]);
    if (!looksLikeTitle(title)) continue;

    const url = absolute(href, baseUrl);
    if (!url) continue;
    if (url === baseUrl) continue;

    // 다른 사이트로 나가는 링크(광고·제휴)는 제외한다
    try {
      if (new URL(url).hostname !== base.hostname) continue;
    } catch {
      continue;
    }
    if (seen.has(url)) continue;

    seen.add(url);
    results.push({ title, url });
  }
  return results;
}

/** 내용 형식에 맞는 파서를 골라 쓴다 */
export function parseNoticeList(body: string, baseUrl: string, contentType: string): ParsedNotice[] {
  const isFeed = /xml|rss|atom/i.test(contentType) || /<rss\b|<feed\b/i.test(body.slice(0, 500));
  return isFeed ? parseFeed(body, baseUrl) : parseLinks(body, baseUrl);
}

/** 키워드가 있으면 제목에 하나라도 들어간 것만 남긴다 */
export function filterByKeywords(items: ParsedNotice[], keywords: string | null): ParsedNotice[] {
  const words = (keywords ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const title = item.title.toLowerCase();
    return words.some((word) => title.includes(word));
  });
}

function absolute(href: string, baseUrl: string): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) return null;
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** RSS 날짜 문자열을 YYYY-MM-DD 로 (실패하면 undefined) */
function toDateStr(value: string): string | undefined {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}
