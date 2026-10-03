/**
 * 페르소나 시뮬레이션 도구.
 *
 * 각 페르소나가 자기 목표대로 앱을 끝까지 써 보게 하고, 단계마다
 * 화면에 무엇이 보였는지(본문 텍스트 + 스크린샷)와 걸린 시간을 남긴다.
 * 판단은 사람이(또는 리뷰어가) 이 기록을 읽고 한다 — 여기서는 증거만 모은다.
 *
 * 한 단계가 실패해도 멈추지 않는다. 막힌 것 자체가 가장 중요한 발견이다.
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../browser.mjs";

export const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT_ROOT = process.env.PERSONA_OUT ?? path.join(process.env.TMPDIR ?? "/tmp", "personas");

export async function startPersona(persona, { mobile = false } = {}) {
  const dir = path.join(OUT_ROOT, persona.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const log = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 200)}`));
  // 콘솔의 "404" 만으로는 무엇이 없는지 모른다 — 주소를 함께 남긴다
  page.on("response", (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url().replace(BASE, "")}`));
  let n = 0;

  /** 지금 화면을 기록한다 */
  async function see(step, note = "") {
    n += 1;
    const file = `${String(n).padStart(2, "0")}-${step.replace(/[^\p{L}\p{N}-]+/gu, "_")}.png`;
    await page.screenshot({ path: path.join(dir, file), fullPage: true }).catch(() => {});
    const text = (await page.locator("main").innerText().catch(() => ""))
      || (await page.locator("body").innerText().catch(() => ""));
    const broken = /화면을 불러오지 못했습니다|오류 번호|Application error/.test(text);
    const overflow = await page
      .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      .catch(() => 0);
    // 가로로 넘치지 않아도, 글자가 좁은 칸에 눌려 한 글자씩 세로로 쪼개질 수 있다
    // (폰에서 활동 제목이 그렇게 깨졌는데 넘침 검사는 0px 이었다)
    const squeezed = await page.evaluate(() => {
      const hits = [];
      for (const el of document.querySelectorAll("main h1, main h2, main h3, main a, main p, main span, main button")) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
        if (own.length < 6) continue;
        const rc = el.getBoundingClientRect();
        if (rc.width > 0 && rc.width < 44 && rc.height > 72) hits.push(own.slice(0, 20));
      }
      return hits.slice(0, 5);
    }).catch(() => []);
    log.push({
      n, step, note, url: page.url().replace(BASE, ""),
      chars: text.length, broken, overflow, squeezed,
      text: text.replace(/\n{3,}/g, "\n\n").slice(0, 4000),
      file,
    });
    return text;
  }

  /** 한 단계를 실행하고 걸린 시간·실패를 남긴다. 실패해도 다음으로 간다. */
  async function act(step, fn) {
    const t0 = Date.now();
    try {
      const result = await fn();
      log.push({ n: ++n, step, ms: Date.now() - t0, ok: true });
      return result;
    } catch (e) {
      log.push({ n: ++n, step, ms: Date.now() - t0, ok: false, error: String(e).split("\n")[0].slice(0, 240) });
      await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, "0")}-FAIL-${step.replace(/[^\p{L}\p{N}-]+/gu, "_")}.png`), fullPage: true }).catch(() => {});
      return undefined;
    }
  }

  async function finish() {
    fs.writeFileSync(
      path.join(dir, "log.json"),
      JSON.stringify({ persona, log, errors: [...new Set(errors)].slice(0, 30) }, null, 2),
    );
    await browser.close();
    const fails = log.filter((e) => e.ok === false);
    const broken = log.filter((e) => e.broken);
    const layout = log.filter((e) => e.overflow > 0 || (e.squeezed ?? []).length > 0);
    console.log(`[${persona.id}] ${persona.name} — 단계 ${log.length}, 실패 ${fails.length}, 깨진 화면 ${broken.length}, 배치 문제 ${layout.length}, 콘솔 오류 ${new Set(errors).size} → ${dir}`);
    for (const e of layout) console.log(`   ⚠ ${e.step}: ${e.overflow > 0 ? `가로 넘침 ${e.overflow}px ` : ""}${e.squeezed?.length ? `눌린 글자 ${JSON.stringify(e.squeezed)}` : ""}`);
    return { fails, broken, layout };
  }

  return { page, context, see, act, finish, dir };
}

/** 회원가입 → 대시보드 */
export async function signup(page, persona) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("이름").fill(persona.name);
  await page.getByLabel("이메일").fill(`${persona.id}-${Date.now()}@persona.test`);
  await page.getByLabel("비밀번호").fill("personapass123!");
  await page.locator('input[name="agree"]').check();
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });
}

/** 커리어 온보딩: 사람이 실제로 할 법한 만큼만 채운다 */
export async function onboard(page, o) {
  await page.goto(`${BASE}/career`);
  if (o.field) await page.getByRole("button", { name: o.field, exact: true }).click();
  if (o.major) await page.locator("#ob-major").fill(o.major);
  await page.locator("#ob-goal").fill(o.goal);
  if (o.companies) await page.locator("#ob-companies").fill(o.companies);
  await page.getByRole("button", { name: "다음" }).click();
  await page.waitForTimeout(1200);
  if (o.headline) await page.locator("#ob-headline").fill(o.headline);
  if (o.github) await page.locator("#ob-github").fill(o.github);
  await page.getByRole("button", { name: "다음" }).click();
  await page.waitForTimeout(1200);
  for (const skill of o.skills ?? []) {
    await page.getByRole("button", { name: skill, exact: true }).first().click().catch(() => {});
  }
  await page.getByRole("button", { name: "내 커리어 시작하기" }).click();
  await page.waitForTimeout(2500);
}

/** 활동을 폼으로 등록한다 (사람이 손으로 입력하는 경로) */
export async function addActivity(page, a) {
  await page.goto(`${BASE}/activities/new`);
  await page.getByLabel("활동명 *").fill(a.name);
  if (a.organizer) await page.getByLabel("주최기관").fill(a.organizer);
  if (a.type) await page.getByLabel("활동 종류").selectOption(a.type);
  if (a.status) await page.getByLabel("상태").selectOption(a.status);
  // 날짜 칸 이름은 활동 종류에 따라 바뀐다(시험이면 '시험일') — id 로 찾는다
  if (a.applyDeadline) await page.locator("#applyDeadline").fill(a.applyDeadline);
  if (a.submitDeadline) await page.locator("#submitDeadline").fill(a.submitDeadline);
  await page.getByRole("button", { name: "활동 만들기", exact: true }).click();
  await page.waitForURL(/\/activities\/[a-z0-9]{20}$/, { timeout: 30000 });
  return page.url();
}

/** 오늘 기준 n일 뒤 YYYY-MM-DD */
export const inDays = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
