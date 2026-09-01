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
