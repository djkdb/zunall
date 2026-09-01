import { ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SKILL_CATEGORIES } from "@/lib/career-constants";
import { cn } from "@/lib/utils";
import type { SkillScoreDetail } from "@/services/score/skill";

/**
 * 스킬 점수 목록. 각 점수는 <details>로 펼쳐 근거(기여 내역)를 확인할 수 있다.
 * 근거 없는 점수를 보여주지 않는 것이 원칙.
 */
export function SkillList({
  skills,
  limit,
  targets,
}: {
  skills: SkillScoreDetail[];
  limit?: number;
  /** 스킬명 → 목표 수준 (Gap 페이지에서 목표선 표시) */
  targets?: Map<string, number>;
}) {
  const list = limit ? skills.slice(0, limit) : skills;

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        아직 등록된 스킬이 없습니다. 근거(Evidence)를 추가하면 스킬 점수가 계산됩니다.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {list.map((skill) => {
        const target = targets?.get(skill.name);
        return (
          <li key={skill.name}>
            <details className="group rounded-md transition-colors hover:bg-accent/40">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-2 py-2 [&::-webkit-details-marker]:hidden">
                <span className="w-32 shrink-0 truncate text-sm">{skill.name}</span>
                <div className="relative flex-1">
                  <Progress
                    value={skill.score}
                    className="h-2"
                    barClassName={cn(
                      skill.score < 40 && "bg-rose-400",
                      skill.score >= 40 && skill.score < 65 && "bg-amber-400",
                    )}
                  />
                  {target !== undefined && (
                    <span
                      className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-foreground/50"
                      style={{ left: `${Math.min(100, target)}%` }}
                      title={`목표 ${target}`}
                    />
                  )}
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold">{skill.score}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mb-2 ml-2 rounded-md border-l-2 border-border py-1 pl-4 pr-2">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    {SKILL_CATEGORIES[skill.category] ?? skill.category}
                  </Badge>
                  근거 {skill.evidenceCount}개 · 신뢰도 {Math.round(skill.confidence * 100)}%
                </div>
                {skill.contributions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    아직 근거가 없습니다. 프로젝트·수상·활동을 근거로 연결해보세요.
                  </p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {skill.contributions.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate">· {c.label}</span>
                        <span className="shrink-0 text-muted-foreground">+{c.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
