/** 공고 목록 파서 테스트. 실행: tsx tests/notice-parse.test.ts */
import { parseFeed, parseLinks, parseNoticeList, filterByKeywords, looksLikeTitle } from "../src/services/notice/parse";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── 제목 판별 ────────────────────────────────────────────────
check("짧은 링크 텍스트는 제외", !looksLikeTitle("더보기"));
check("페이지 번호는 제외", !looksLikeTitle("12"));
check("날짜만 있는 링크 제외", !looksLikeTitle("2026.09.15"));
check("공고 제목은 통과", looksLikeTitle("2026 그린테크 아이디어 공모전 참가자 모집"));

// ── HTML 목록 ────────────────────────────────────────────────
const html = `
<html><body>
  <nav><a href="/login">로그인</a><a href="/">홈으로</a></nav>
  <ul>
    <li><a href="/notice/101">2026 그린테크 아이디어 공모전 모집</a> <span>2026-09-01</span></li>
    <li><a href="/notice/102">제7회 대학생 마케팅 공모전 안내</a></li>
    <li><a href="https://other.example.com/ad">외부 광고 배너 링크입니다</a></li>
    <li><a href="/notice/101">2026 그린테크 아이디어 공모전 모집</a></li>
  </ul>
  <div class="paging"><a href="?page=2">2</a><a href="?page=3">다음</a></div>
</body></html>`;

const links = parseLinks(html, "https://example.com/notices");
check("공고 링크만 남음", links.length === 2, links.map((l) => l.title).join(" | "));
check("절대 주소로 변환", links[0]?.url === "https://example.com/notice/101", links[0]?.url);
check("중복 링크 제거", new Set(links.map((l) => l.url)).size === links.length);
check("다른 사이트 링크 제외", !links.some((l) => l.url.includes("other.example.com")));
check("메뉴/페이지 링크 제외", !links.some((l) => /로그인|다음|홈으로/.test(l.title)));

// ── RSS ──────────────────────────────────────────────────────
const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>공모전 소식</title>
  <item>
    <title>2026 청년 정책 아이디어 공모전</title>
    <link>https://example.com/rss/1</link>
    <pubDate>Mon, 01 Sep 2026 09:00:00 +0900</pubDate>
  </item>
  <item>
    <title><![CDATA[제10회 사회혁신 해커톤 참가자 모집]]></title>
    <link>/rss/2</link>
  </item>
</channel></rss>`;

const feed = parseFeed(rss, "https://example.com/feed.xml");
check("RSS 항목 수", feed.length === 2, String(feed.length));
check("RSS 날짜 파싱", feed[0]?.publishedAt === "2026-09-01", feed[0]?.publishedAt ?? "없음");
check("RSS CDATA 제목", feed[1]?.title.includes("사회혁신 해커톤"), feed[1]?.title);
check("RSS 상대 주소 변환", feed[1]?.url === "https://example.com/rss/2", feed[1]?.url);

// ── Atom ─────────────────────────────────────────────────────
const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>2026 데이터 분석 경진대회</title>
    <link href="https://example.com/atom/1"/>
    <updated>2026-08-20T00:00:00Z</updated>
  </entry>
</feed>`;
const atomItems = parseNoticeList(atom, "https://example.com/atom.xml", "application/atom+xml");
check("Atom entry 파싱", atomItems.length === 1 && atomItems[0].url === "https://example.com/atom/1");
check("Atom 날짜", atomItems[0]?.publishedAt === "2026-08-20", atomItems[0]?.publishedAt ?? "없음");

// ── 형식 자동 판별 ───────────────────────────────────────────
check(
  "content-type 없이도 RSS 판별",
  parseNoticeList(rss, "https://example.com/feed", "").length === 2,
);
check(
  "HTML 은 링크 파서로",
  parseNoticeList(html, "https://example.com/notices", "text/html").length === 2,
);

// ── 키워드 필터 ──────────────────────────────────────────────
const filtered = filterByKeywords(links, "마케팅");
check("키워드로 좁히기", filtered.length === 1 && filtered[0].title.includes("마케팅"));
check("키워드 없으면 전체", filterByKeywords(links, null).length === links.length);
check("여러 키워드 OR", filterByKeywords(links, "그린테크, 마케팅").length === 2);
check("대소문자 무시", filterByKeywords([{ title: "AI Hackathon 2026 모집", url: "u" }], "ai").length === 1);

console.log(`\n${passed}개 통과${failed > 0 ? `, ${failed}개 실패` : ""}`);
if (failed > 0) process.exit(1);
