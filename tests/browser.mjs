/**
 * 테스트용 브라우저 실행 헬퍼.
 *
 * 실행 파일은 다음 순서로 고른다.
 *   1. CHROMIUM_PATH 가 있으면 그것
 *   2. 이 개발 환경에 미리 깔린 /opt/pw-browsers/chromium 이 있으면 그것
 *   3. 둘 다 없으면 Playwright 가 자기 버전에 맞는 브라우저를 직접 찾는다
 *      (CI 의 공식 Playwright 이미지가 이 경우다)
 *
 * 예전에는 2번을 무조건 썼다. CI 에서 경로를 찾는 셸 명령이 Playwright 버전에
 * 따라 바뀐 폴더 이름(chrome-linux → chrome-linux64)을 못 찾자 2번으로
 * 떨어졌고, CI 에는 그 경로가 없어 브라우저 테스트가 한 번도 돌지 못했다.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium";

export function launchBrowser(options = {}) {
  const executablePath =
    process.env.CHROMIUM_PATH || (existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined);
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), ...options });
}

/**
 * 실패한 순간 화면이 무엇을 보여주고 있었는지 한 줄로 요약한다.
 * CI 로그 전문을 열 수 없어도, 주석으로 올라간 이 한 줄에 검증 메시지나
 * 오류 문구가 보이면 원인을 바로 알 수 있다.
 */
export async function describePage(page) {
  if (!page) return "(페이지 없음)";
  const url = page.url();
  const text = await page
    .locator("body")
    .innerText({ timeout: 3000 })
    .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 400))
    .catch(() => "(본문을 읽지 못함)");
  return `주소 ${url} | 화면: ${text}`;
}
