// 목표 → 역할 템플릿 매칭 (순수 함수)

import { ROLE_TEMPLATES, type RoleTemplate } from "@/lib/career-constants";

export interface GoalLike {
  name: string;
  type: string;
  targetRoles: string[];
}

/** 목표 이름/희망 직무 텍스트로 가장 적합한 역할 템플릿을 찾는다. */
export function matchTemplate(goal: GoalLike | null): RoleTemplate {
  const general = ROLE_TEMPLATES.find((t) => t.key === "general")!;
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
