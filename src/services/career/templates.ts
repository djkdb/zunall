// 목표 → 역할 템플릿 매칭 (순수 함수)

import { ROLE_TEMPLATES, type RoleTemplate, type StudyField } from "@/lib/career-constants";

export interface GoalLike {
  name: string;
  type: string;
  targetRoles: string[];
}

/**
 * 역할 템플릿을 고른다.
 * 사용자가 희망 직무를 직접 골랐다면(roleKey) 그것이 가장 정확하므로 먼저 쓰고,
 * 없을 때만 목표 텍스트에서 추측한다.
 */
export function matchTemplate(goal: GoalLike | null, roleKey?: string | null): RoleTemplate {
  const general = ROLE_TEMPLATES.find((t) => t.key === "general")!;

  if (roleKey) {
    const picked = ROLE_TEMPLATES.find((t) => t.key === roleKey);
    if (picked) return picked;
  }
  if (!goal) return general;

  return templateHits([goal.name, ...goal.targetRoles].join(" "))[0]?.template ?? general;
}

/**
 * 키워드가 맞는 직무를 많이 맞은 순서로 (같으면 목록 순서).
 * "pr", "ae", "ib" 같은 짧은 영문 키워드는 단어 단위로만 맞춘다 —
 * 그냥 포함 여부로 보면 "product", "library" 안에서도 걸렸다.
 */
export function templateHits(text: string): { template: RoleTemplate; hits: number }[] {
  const haystack = text.toLowerCase();
  const matches = (keyword: string) => {
    const k = keyword.toLowerCase();
    if (/^[a-z&]{1,4}$/.test(k)) return new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(haystack);
    return haystack.includes(k);
  };

  // 맞은 개수가 같으면 문장에서 먼저 나온 쪽 — "퍼스널 트레이너, 체육교사도 고민"의 주 목표는 트레이너다
  const firstAt = (template: RoleTemplate) =>
    Math.min(...template.keywords.filter(matches).map((k) => haystack.indexOf(k.toLowerCase())).filter((i) => i >= 0), Infinity);
  return ROLE_TEMPLATES.filter((t) => t.key !== "general")
    .map((template) => ({ template, hits: template.keywords.filter(matches).length }))
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits || firstAt(a.template) - firstAt(b.template));
}

/** 계열에 해당하는 희망 직무 목록 (계열이 없으면 전체). general 은 항상 마지막. */
export function templatesForField(field: StudyField | null | undefined): RoleTemplate[] {
  const list = ROLE_TEMPLATES.filter((t) => t.key !== "general");
  const scoped = field ? list.filter((t) => t.field === field) : list;
  const general = ROLE_TEMPLATES.find((t) => t.key === "general")!;
  return [...(scoped.length > 0 ? scoped : list), general];
}
