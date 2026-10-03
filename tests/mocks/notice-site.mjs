/**
 * 가짜 공고 사이트 (테스트 전용) — 8795
 *   /notice → 공고 본문 (주최·마감·심사 기준이 들어 있다)
 *   /pdf    → 웹페이지가 아닌 응답
 *   /empty  → 본문이 비어 있는 페이지
 *   그 외   → 404
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_SITE_PORT ?? 8795);
const NOTICE = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>캐버로 AI 아이디어 공모전</title></head><body>
<h1>2026 캐버로 AI 아이디어 공모전</h1>
<p>주최: 한국인공지능협회</p>
<h2>접수 안내</h2>
<ul>
  <li>접수기간: 2026.09.20 ~ 2026.10.20</li>
  <li>지원 마감: 2026.10.20</li>
  <li>제출 마감: 2026.11.10</li>
  <li>결과 발표: 2026.12.01</li>
</ul>
<h2>지원 자격</h2><p>전국 대학생 및 대학원생, 3인 이내 팀</p>
<h2>제출 서류</h2><p>참가신청서, 아이디어 기획서(PDF 15p 이내)</p>
<h2>심사 기준</h2>
<ul><li>창의성 40%</li><li>실현 가능성 35%</li><li>사회적 효과 25%</li></ul>
<h2>문의</h2><p>02-000-0000</p>
</body></html>`;

createServer((req, res) => {
  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
  if (path === "/notice") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(NOTICE);
  } else if (path === "/pdf") {
    res.writeHead(200, { "content-type": "application/pdf" });
    res.end(Buffer.from("%PDF-1.4\n%fake\n"));
  } else if (path === "/empty") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><head><title>빈 페이지</title></head><body></body></html>");
  } else {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<html><body>없는 페이지</body></html>");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`mock notice site on ${PORT}`));
