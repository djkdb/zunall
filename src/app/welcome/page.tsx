import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Link2,
  Crosshair,
  PenLine,
  Bell,
  BookMarked,
  MessageCircleQuestion,
  ArrowRight,
  Check,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { CaveroMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cavero — 공모전·대외활동·인턴을 한곳에서",
  description:
    "공고 링크만 붙여넣으면 마감일과 제출물이 자동으로 정리됩니다. 지원할지 판단하고, 자소서를 쓰고, 마감을 놓치지 않게 챙겨줍니다. 대학생을 위한 무료 서비스입니다.",
};

/**
 * 로그인 전에 보이는 소개 화면.
 * "이게 뭐 하는 서비스인지"를 가입 전에 알 수 있어야 한다.
 */
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <CaveroMark className="h-7 w-7 text-[#0F2338] dark:text-foreground" />
          <span className="text-base font-bold tracking-[0.18em]">CAVERO</span>
        </div>
        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          로그인
        </Link>
      </header>

      {/* 무엇을 해주는 서비스인가 */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:pt-16">
        <p className="text-sm font-semibold text-primary">대학생을 위한 활동 관리 · 무료</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          공모전·대외활동·인턴,
          <br />
          흩어진 마감을 한곳에서
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          공고 링크만 붙여넣으면 마감일·자격·제출 서류·평가 기준이 자동으로 정리됩니다. 지원할지
          판단하고, 자기소개서를 쓰고, 마감을 놓치지 않게 챙겨드립니다.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/signup">
            <Button size="lg">
              무료로 시작하기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              이미 계정이 있어요
            </Button>
          </Link>
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {["신용카드 없이 가입", "학교 이메일 아니어도 됩니다", "언제든 내 자료를 내려받고 계정을 지울 수 있어요"].map(
            (item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </li>
            ),
          )}
        </ul>
      </section>

      {/* 어떻게 쓰나 */}
      <section className="border-y bg-secondary/40 py-10 dark:bg-secondary/20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-lg font-bold tracking-tight">이렇게 씁니다</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
            {[
              {
                step: "1",
                title: "공고 링크를 붙여넣습니다",
                body: "마감일·지원 자격·제출 서류·평가 기준을 읽어 활동을 만들어 둡니다. 직접 입력해도 됩니다.",
              },
              {
                step: "2",
                title: "지원할지 판단합니다",
                body: "내 경험과 공고가 요구하는 것을 비교해 지원·보강·비추천과 그 이유를 알려줍니다.",
              },
              {
                step: "3",
                title: "쓰고, 제출하고, 남깁니다",
                body: "자기소개서 문항별로 쓰고 첨삭받고, 마감 전에 알림을 받고, 끝나면 회고가 포트폴리오가 됩니다.",
              },
            ].map((item) => (
              <li key={item.step} className="rounded-lg border bg-card p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {item.step}
                </span>
                <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 무엇이 들어 있나 */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-lg font-bold tracking-tight">들어 있는 기능</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {[
            { icon: Link2, title: "공고 링크 자동 정리", body: "주소만 넣으면 마감일과 제출물이 채워집니다." },
            { icon: Bell, title: "마감 알림", body: "D-7·3·1·당일에 알려줍니다. 알림 시점은 직접 고릅니다." },
            { icon: Crosshair, title: "지원 적합도", body: "지금의 나에게 좋은 기회인지 근거와 함께 판단합니다." },
            { icon: PenLine, title: "자기소개서", body: "문항별로 쓰고 첨삭받고, 예전 답변을 찾아 다시 씁니다." },
            { icon: MessageCircleQuestion, title: "면접 준비", body: "내가 쓴 자소서에서 파고드는 질문을 만들어 줍니다." },
            { icon: BookMarked, title: "포트폴리오", body: "쌓인 기록이 한 장이 되고, 링크로 공유합니다." },
          ].map((item) => (
            <li key={item.title} className="flex gap-3">
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 솔직한 안내 */}
      <section className="mx-auto max-w-5xl px-4 pb-10">
        <div className="rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">합격을 예측하지 않습니다.</strong> 점수와 판단은 내가
            남긴 기록을 근거로 계산한 &ldquo;준비 상태&rdquo;일 뿐입니다. 지원 여부는 본인이
            정합니다.
          </p>
          <p className="mt-2">
            내가 올린 공고문·자기소개서는 내 계정에서만 보입니다. AI 분석은 내가 버튼을 눌렀을 때만
            실행됩니다. 자세한 내용은{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              개인정보처리방침
            </Link>
            에 적어두었습니다.
          </p>
        </div>
      </section>

      <section className="border-t py-10">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="text-xl font-bold tracking-tight">지금 챙겨야 할 마감이 있나요?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            공고 링크 하나만 있으면 1분 안에 정리됩니다.
          </p>
          <Link href="/signup" className="mt-4 inline-block">
            <Button size="lg">
              무료로 시작하기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Cavero</span>
          <Link href="/terms" className="hover:text-foreground">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            개인정보처리방침
          </Link>
        </div>
      </footer>
    </div>
  );
}
