/**
 * 가짜 공고 목록 사이트 (테스트 전용) — 8796
 *   /          → 공고 목록 HTML (메뉴·페이지 번호 링크 포함 — 걸러져야 한다)
 *   /add       → 목록에 공고 1건 추가 (새 글 감지 테스트용)
 *   /feed.xml  → RSS (CDATA 제목 포함)
 *   /notice/n  → 공고 상세
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_LIST_PORT ?? 8796);
const base = [
  "2026 그린테크 아이디어 공모전 참가자 모집",
  "제7회 대학생 데이터 분석 공모전 안내",
  "2026 오픈소스 해커톤 참가 안내",
  "청년 마케팅 아이디어 공모전 모집 공고",
];
const extra = [];

const listPage = () => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>공고 목록</title></head><body>
<nav><a href="/">홈으로</a> <a href="/login">로그인</a></nav>
<ul>
${[...base, ...extra].map((t, i) => `<li><a href="/notice/${i + 1}">${t}</a></li>`).join("\n")}
</ul>
<div class="paging"><a href="/?page=1">1</a> <a href="/?page=2">2</a> <a href="/?page=2">다음</a></div>
</body></html>`;

const feed = () => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>공고 피드</title><link>http://127.0.0.1:${PORT}/</link>
  <item>
    <title><![CDATA[2026 대학생 오픈소스 해커톤 모집]]></title>
    <link>http://127.0.0.1:${PORT}/notice/101</link>
    <pubDate>Mon, 07 Sep 2026 09:00:00 +0900</pubDate>
  </item>
  <item>
    <title>봉사활동 서포터즈 모집 안내</title>
    <link>http://127.0.0.1:${PORT}/notice/102</link>
    <pubDate>Sun, 06 Sep 2026 09:00:00 +0900</pubDate>
  </item>
</channel></rss>`;

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const html = (body, status = 200) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  };
  if (url.pathname === "/add") {
    extra.push(`추가 공모전 ${extra.length + 1} 참가자 모집`);
    return html(`<html><body>추가됨 (${extra.length})</body></html>`);
  }
  if (url.pathname === "/feed.xml") {
    res.writeHead(200, { "content-type": "application/rss+xml; charset=utf-8" });
    return res.end(feed());
  }
  if (url.pathname.startsWith("/notice/")) {
    return html(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>공고 상세</title></head><body>
<h1>2026 그린테크 아이디어 공모전 참가자 모집</h1><p>주최: 한국환경산업기술원</p><p>지원 마감: 2026.10.31</p>
<h2>심사 기준</h2><ul><li>창의성 40%</li><li>실현 가능성 35%</li></ul></body></html>`);
  }
  if (url.pathname === "/") return html(listPage());
  return html("<html><body>없음</body></html>", 404);
}).listen(PORT, "127.0.0.1", () => console.log(`mock list site on ${PORT}`));
