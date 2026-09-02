/** 테스트용 브라우저 실행 헬퍼. CHROMIUM_PATH 로 실행 파일을 바꿀 수 있다(CI 대응). */
import { chromium } from "playwright-core";

export function launchBrowser(options = {}) {
  const executablePath = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
  return chromium.launch({ executablePath, ...options });
}
