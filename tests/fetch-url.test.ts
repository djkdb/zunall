/** 공고 URL 파서 단위 테스트. 실행: npx tsx tests/fetch-url.test.ts */
import { htmlToText, htmlTitle, validateNoticeUrl } from "../src/services/document/html-text";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

// ── SSRF 차단 ────────────────────────────────────────────────
const blocked = [
  ["루프백", "http://127.0.0.1:8080/x"],
  ["localhost", "http://localhost/x"],
  ["사설망 10.x", "http://10.0.0.5/x"],
  ["사설망 192.168.x", "http://192.168.0.1/x"],
  ["사설망 172.16.x", "http://172.20.1.1/x"],
  ["클라우드 메타데이터", "http://169.254.169.254/latest/meta-data/"],
  ["IPv6 루프백", "http://[::1]/x"],
  ["내부 도메인", "http://intranet.local/x"],
  ["file 스킴", "file:///etc/passwd"],
  ["ftp 스킴", "ftp://example.com/x"],
];
for (const [name, url] of blocked) {
  check(`차단: ${name}`, "error" in validateNoticeUrl(url));
}
check("허용: 일반 https 주소", "url" in validateNoticeUrl("https://www.campuspick.com/contest/view?id=123"));

// ── HTML → 텍스트 ────────────────────────────────────────────
const html = `<!doctype html><html><head><title>2026 AI 공모전 &middot; 캠퍼스픽</title>
<style>.a{color:red}</style><script>var x = "<p>가짜</p>";</script></head>
<body><nav>메뉴 홈 로그인</nav>
<h1>2026 AI 아이디어 공모전</h1>
<p>주최: 한국인공지능협회</p>
<ul><li>접수기간: 2026.09.01 ~ 2026.09.30</li><li>시상: 대상 500만원</li></ul>
<table><tr><td>제출물</td><td>기획서 PDF</td></tr></table>
<p>문의: contest@example.com</p>
<footer>copyright</footer></body></html>`;

const text = htmlToText(html);
check("제목 추출 (엔티티 복원)", htmlTitle(html) === "2026 AI 공모전 · 캠퍼스픽", htmlTitle(html));
check("script/style 내용 제거", !text.includes("가짜") && !text.includes("color:red"));
check("nav/footer 제거", !text.includes("메뉴 홈 로그인") && !text.includes("copyright"));
check("본문 유지", text.includes("2026 AI 아이디어 공모전") && text.includes("한국인공지능협회"));
check("목록을 '- ' 로 변환", text.includes("- 접수기간: 2026.09.01 ~ 2026.09.30"), text.split("\n").find((l) => l.includes("접수기간")));
check("표 셀 구분", text.includes("제출물 | 기획서 PDF"));
check("연속 공백/개행 정리", !/\n{3,}/.test(text) && !/ {2,}/.test(text));

console.log(failed === 0 ? "\n모든 테스트 통과" : `\n${failed}개 실패`);
process.exit(failed === 0 ? 0 : 1);
