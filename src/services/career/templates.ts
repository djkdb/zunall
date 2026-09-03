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

  const haystack = [goal.name, ...goal.targetRoles].join(" ").toLowerCase();
  let best: { template: RoleTemplate; hits: number } | null = null;

  for (const template of ROLE_TEMPLATES) {
    if (template.key === "general") continue;
    const hits = template.keywords.filter((k) => haystack.includes(k.toLowerCase())).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { template, hits };
    }
  }
  return best?.template ?? general;
}

/** 계열에 해당하는 희망 직무 목록 (계열이 없으면 전체). general 은 항상 마지막. */
export function templatesForField(field: StudyField | null | undefined): RoleTemplate[] {
  const list = ROLE_TEMPLATES.filter((t) => t.key !== "general");
  const scoped = field ? list.filter((t) => t.field === field) : list;
  const general = ROLE_TEMPLATES.find((t) => t.key === "general")!;
  return [...(scoped.length > 0 ? scoped : list), general];
}
