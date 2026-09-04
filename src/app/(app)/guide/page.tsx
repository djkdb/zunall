import type { Metadata } from "next";
import Link from "next/link";
import {
  Target,
  UserRoundPen,
  FolderPlus,
  Sparkles,
  BookMarked,
  CircleCheck,
  Circle,
  ArrowRight,
  Link2,
  CalendarPlus,
  Bell,
  PenLine,
  Search,
  Crosshair,
  Download,
  Copy,
  Rss,
  MessageCircleQuestion,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getGuideCounts } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CaveroMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "시작 가이드" };

/**
 * 시작 가이드.
 *
 * "뭘 어떻게 써야 하는지 모르겠다"는 문제를 정면으로 다룬다.
 * 설명만 늘어놓지 않고, 지금 내 계정 상태를 읽어 어디까지 했고 다음에 뭘 하면
 * 되는지 보여준다.
 */
export default async function GuidePage() {
  const user = await requireUser();

  // 다섯 개 개수를 한 번의 쿼리로 센다.
  const counts = await getGuideCounts(user.id);
  const goal = counts.goals > 0;
  const evidenceCount = counts.evidence;
  const activityCount = counts.activities;
  const reviewCount = counts.reviews;
  const retroCount = counts.retrospectives;

  const steps = [
    {
      icon: Target,
      title: "1. 목표 직무를 정한다",
      why: "목표가 있어야 '이 공고가 나한테 맞는지'를 판단할 수 있습니다. 없으면 그냥 일정 관리 앱이 됩니다.",
      action: { label: "목표 설정하기", href: "/career" },
      done: Boolean(goal),
    },
    {
      icon: UserRoundPen,
      title: "2. 내 이력을 한 번에 넣는다",
      why: "이력서나 자기소개를 붙여넣으면 스킬과 근거를 뽑아 점수에 반영합니다. 정보가 적으면 점수가 실제보다 낮게 나옵니다.",
      action: { label: "이력 붙여넣기", href: "/career" },
      done: evidenceCount >= 3,
    },
    {
      icon: FolderPlus,
      title: "3. 관심 있는 공고를 등록한다",
      why: "공고 링크나 공고문만 넣으면 활동명·주최·마감일·평가 기준까지 자동으로 채워집니다.",
      action: { label: "공고로 활동 만들기", href: "/activities/new" },
      done: activityCount > 0,
    },
    {
      icon: Sparkles,
      title: "4. 지원할지 AI로 판단한다",
      why: "적합도를 계산해 '지원하는 게 나은지, 지금은 다른 걸 하는 게 나은지'까지 알려줍니다. 제출물은 평가 기준으로 채점받습니다.",
      action: { label: "기회 보러 가기", href: "/opportunities" },
      done: reviewCount > 0,
    },
    {
      icon: BookMarked,
      title: "5. 끝나면 회고를 남긴다",
      why: "STAR로 남긴 회고는 그대로 자소서 재료가 되고, 적어둔 스킬은 커리어 근거가 됩니다.",
      action: { label: "포트폴리오 보기", href: "/portfolio" },
      done: retroCount > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  const features = [
    { icon: Link2, title: "공고 링크로 등록", desc: "주소만 붙여넣으면 마감일·자격·제출물·배점을 읽어옵니다." },
    { icon: Rss, title: "공고 자동 수집", desc: "자주 보는 사이트를 등록해두면 새 공고를 찾아 알려줍니다." },
    { icon: Crosshair, title: "지원 적합도", desc: "내 역량과 공고 요구를 비교해 지원/보류/비추천과 대안을 제시합니다." },
    { icon: PenLine, title: "자소서 문항 코칭", desc: "문항별로 저장하고 첨삭받으면 버전마다 점수 변화가 남습니다." },
    { icon: MessageCircleQuestion, title: "면접 준비", desc: "내 자소서에서 파고드는 예상 질문을 만들고 답변을 적어둡니다." },
    { icon: Sparkles, title: "제출물 AI 평가", desc: "공고의 평가 기준 그대로 항목별 점수와 개선점을 받습니다." },
    { icon: CalendarPlus, title: "캘린더 구독", desc: "마감을 구글·애플 캘린더에 자동으로 띄웁니다." },
    { icon: Bell, title: "마감 알림", desc: "D-7·3·1·당일에 앱과 브라우저 알림으로 알려줍니다." },
    { icon: Copy, title: "활동 복제", desc: "매년 열리는 공모전은 지난 회차를 복사해 바로 시작합니다." },
    { icon: Search, title: "전체 검색", desc: "문서 본문·메모·자소서 답변까지 한 번에 찾습니다." },
    { icon: Download, title: "데이터 내보내기", desc: "내 데이터를 언제든 JSON 한 파일로 가져갈 수 있습니다." },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <CaveroMark className="mt-0.5 h-9 w-9 shrink-0 text-[#0F2338] dark:text-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cavero 시작 가이드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cavero는 <strong>공모전·대외활동·인턴을 등록해 마감을 관리하고</strong>,{" "}
            <strong>목표 직무 기준으로 지원할지 판단하고</strong>,{" "}
            <strong>제출물과 자소서를 다듬어 결과를 기록</strong>하는 곳입니다. 아래 5단계만
            따라오면 됩니다.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">진행 상황 {doneCount}/{steps.length}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={percent} />
          <ol className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="flex flex-wrap items-start gap-3 rounded-lg border p-3 sm:flex-nowrap"
                >
                  <span className="mt-0.5">
                    {step.done ? (
                      <CircleCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Icon className="h-4 w-4 text-primary" />
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.why}</p>
                  </div>
                  <Link href={step.action.href} className="shrink-0">
                    <Button size="sm" variant={step.done ? "outline" : "default"}>
                      {step.done ? "다시 보기" : step.action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">이런 것도 됩니다</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardContent className="p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon className="h-4 w-4 text-primary" />
                    {feature.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="bg-secondary/40">
        <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 text-sm font-semibold text-foreground">점수에 대해</p>
          Career Score는 합격 확률이 아니라 <strong>목표 대비 준비도</strong>입니다. 자기 평가가
          아니라 등록한 <strong>근거(Evidence)</strong>로 계산되며, 점수를 누르면 어떤 항목에서
          몇 점이 나왔는지 그대로 보여줍니다. 정보를 적게 넣으면 점수도 낮게 나오니,{" "}
          <Link href="/career" className="text-primary hover:underline">
            이력 붙여넣기
          </Link>
          부터 하시는 걸 권합니다.
        </CardContent>
      </Card>
    </div>
  );
}
