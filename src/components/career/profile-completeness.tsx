import Link from "next/link";
import { CircleCheck, Circle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ReadinessResult } from "@/services/score/readiness";

interface CompletenessInput {
  hasGoal: boolean;
  hasHeadline: boolean;
  hasSummary: boolean;
  skillCount: number;
  evidenceCount: number;
  activityCount: number;
  retrospectiveCount: number;
  readiness: ReadinessResult;
}

/**
 * 정보 완성도.
 *
 * 점수가 낮은 이유가 "내가 부족해서"가 아니라 "아직 정보를 안 넣어서"일 수 있다.
 * 무엇이 비었고, 그걸 채우면 점수의 어느 항목이 오르는지 그대로 보여준다.
 */
export function ProfileCompleteness(input: CompletenessInput) {
  const items = [
    {
      done: input.hasGoal,
      title: "목표 직무 설정",
      why: "목표가 있어야 요구 역량과 비교할 수 있습니다 (준비 기본기 15점)",
      href: "/career",
    },
    {
      done: input.hasHeadline && input.hasSummary,
      title: "한 줄 소개와 요약",
      why: "AI 분석이 나를 이해하는 기본 정보입니다 (준비 기본기 15점)",
      href: "/career",
    },
    {
      done: input.skillCount >= 5,
      title: `보유 스킬 ${input.skillCount}/5개 이상`,
      why: "스킬이 적으면 목표 대비 충족도가 과소평가됩니다 (목표 스킬 55점)",
      href: "/career/skills",
    },
    {
      done: input.evidenceCount >= 6,
      title: `근거 ${input.evidenceCount}/6건 이상`,
      why: "자기 평가만으로는 점수가 오르지 않습니다. 근거가 있어야 인정됩니다 (검증 근거 15점)",
      href: "/career/skills",
    },
    {
      done: input.activityCount >= 3,
      title: `활동 ${input.activityCount}/3개 이상 등록`,
      why: "참여·완료·수상이 실전 경험 점수가 됩니다 (실전 경험 15점)",
      href: "/activities/new",
    },
    {
      done: input.retrospectiveCount >= 1,
      title: "끝난 활동 회고 1건",
      why: "회고에 적은 스킬이 근거로 자동 등록됩니다",
      href: "/activities",
    },
  ];

  const doneCount = items.filter((item) => item.done).length;
  const percent = Math.round((doneCount / items.length) * 100);
  const next = items.filter((item) => !item.done).slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">정보 완성도</CardTitle>
        <p className="text-xs text-muted-foreground">
          {doneCount}/{items.length}개 채움 · 채울수록 점수가 실제 실력에 가까워집니다
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={percent} />

        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-2 text-xs">
              {item.done ? (
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
              <span className={item.done ? "text-muted-foreground line-through" : ""}>
                {item.title}
              </span>
            </li>
          ))}
        </ul>

        {next.length > 0 && (
          <div className="space-y-1.5 rounded-md bg-secondary/50 p-2.5">
            <p className="text-xs font-semibold">지금 채우면 좋은 것</p>
            {next.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="block rounded px-1 py-0.5 text-xs hover:bg-accent"
              >
                <span className="font-medium text-primary">
                  {item.title} <ArrowRight className="inline h-3 w-3" />
                </span>
                <span className="block text-muted-foreground">{item.why}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
