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
