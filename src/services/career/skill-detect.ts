// 텍스트에서 카탈로그 스킬 감지 (순수 함수).
// 공고 요구 역량 추출(mock)과 활동→근거 임포트에서 함께 사용한다.

import { SKILL_CATALOG } from "@/lib/career-constants";

/** 텍스트에서 발견된 카탈로그 스킬명 목록 (발견 빈도순) */
export function detectSkills(text: string, limit = 8): string[] {
  const lower = text.toLowerCase();
  const hits: Array<{ name: string; count: number }> = [];

  for (const skill of SKILL_CATALOG) {
    let count = 0;
    for (const alias of skill.aliases) {
      const needle = alias.toLowerCase();
      let idx = lower.indexOf(needle);
      while (idx !== -1) {
        count++;
        idx = lower.indexOf(needle, idx + needle.length);
      }
    }
    if (count > 0) hits.push({ name: skill.name, count });
  }

  return hits
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((h) => h.name);
}

/** 자유 입력 스킬명(예: "React, 데이터분석")을 카탈로그 스킬명으로 정규화. 매칭 실패 시 원문 유지 */
export function normalizeSkillNames(raw: string[]): string[] {
  const out = new Set<string>();
  for (const item of raw) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const catalogHit = SKILL_CATALOG.find(
      (s) =>
        s.name.toLowerCase() === lower ||
        s.aliases.some((a) => a.toLowerCase() === lower),
    );
    out.add(catalogHit ? catalogHit.name : trimmed.slice(0, 30));
  }
  return Array.from(out);
}

/**
 * 자유 입력 스킬명 하나가 어느 카탈로그 역량에 속하는지 (없으면 null).
 * 정확히 같은 이름·별칭이 먼저이고, 아니면 이름 안에 든 별칭으로 찾는다.
 * 여러 개가 걸리면 가장 긴 별칭을 고른다 — "데이터베이스 인덱스 설계"는 "데이터"(데이터 분석)가 아니라
 * "데이터베이스"(Backend)다. 짧은 영문 별칭은 단어 단위로만 본다 ("mysql" 안의 "sql" 은 무시).
 */
export function catalogSkillFor(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  const exact = SKILL_CATALOG.find(
    (s) => s.name.toLowerCase() === lower || s.aliases.some((a) => a.toLowerCase() === lower),
  );
  if (exact) return exact.name;

  let best: { name: string; length: number } | null = null;
  for (const skill of SKILL_CATALOG) {
    for (const alias of skill.aliases) {
      const a = alias.toLowerCase();
      if (a.length < 2) continue;
      const hit = /^[a-z0-9 .+#-]+$/.test(a)
        ? new RegExp(`(^|[^a-z0-9])${a.replace(/[.+#-]/g, "\\$&")}([^a-z0-9]|$)`).test(lower)
        : lower.includes(a);
      if (hit && (!best || a.length > best.length)) best = { name: skill.name, length: a.length };
    }
  }
  return best?.name ?? null;
}

/**
 * 이력에서 뽑은 스킬명을 점수에 반영되도록 넓힌다.
 * "Spring Boot", "백엔드 개발" 처럼 구체적인 이름은 포트폴리오 태그로 남기고,
 * 해당하는 카탈로그 역량(Backend)을 함께 붙인다. 그래야 이력을 넣었는데도
 * "Backend -74" 가 그대로인 일이 없다.
 */
export function expandSkillsForScoring(raw: string[]): string[] {
  const out = new Set<string>();
  for (const item of raw) {
    const trimmed = item.trim().slice(0, 30);
    if (!trimmed) continue;
    const catalog = catalogSkillFor(trimmed);
    if (catalog && catalog.toLowerCase() !== trimmed.toLowerCase()) {
      // 별칭과 정확히 같으면(예: "백엔드") 카탈로그 이름 하나로 충분하다
      const isAlias = SKILL_CATALOG.some((s) => s.aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase()));
      if (!isAlias) out.add(trimmed);
      out.add(catalog);
    } else {
      out.add(catalog ?? trimmed);
    }
  }
  return Array.from(out);
}
