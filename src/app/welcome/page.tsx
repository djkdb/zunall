import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Link2,
  Crosshair,
  PenLine,
  Bell,
  BookMarked,
  Compass,
  Mic,
  Rss,
  ArrowRight,
  Check,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { CaveroMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PLAN_FEATURES, PLAN_NOTE } from "@/lib/plans";
import { ProductPreview, InterviewRoomPreview } from "@/components/welcome/product-preview";
import { ROLE_STATS } from "@/services/mock-interview/shared/roles";
import { COMPANIES } from "@/services/mock-interview/shared/companies";

export const metadata: Metadata = {
  title: { absolute: "Cavero — 지원할 곳 고르기부터 모의 면접까지" },
  description:
    "공모전·대외활동·인턴·채용 공고를 붙여넣으면 마감일과 제출 서류가 자동으로 정리되고, 목표 직무 기준으로 지원할 만한지 알려줍니다. 자소서 첨삭과 AI 모의 면접까지. 대학생을 위한 무료 서비스입니다.",
};

const FIELDS: Array<[string, string]> = [
  ["인문", "학예사 · 편집자 · 번역가"],
  ["사회", "상담사 · 공공기관 · 기자"],
  ["상경", "마케터 · 회계 · 금융"],
  ["공학", "개발자 · 설계 · 품질"],
  ["자연", "연구원 · 분석 · 바이오"],
  ["의약", "간호사 · 약사 · 보건"],
  ["교육", "교사 · 교육기획 · 강사"],
  ["예체능", "작가 · 공연기획 · 트레이너"],
];

const FAQ: Array<[string, string]> = [
  ["정말 무료인가요?", "지금은 모든 기능이 무료입니다. 나중에 유료 요금제가 생기더라도 미리 알려드리고, 쌓은 자료는 언제든 내려받을 수 있습니다."],
  ["제 자소서나 답변이 AI 학습에 쓰이나요?", "아니요. 내가 올린 공고문·자기소개서·면접 답변은 내 계정에서만 보이고, AI 분석은 내가 버튼을 눌렀을 때만 그 내용으로 한 번 실행됩니다. 모의 면접이 끝나면 자소서 원문은 기록에 남기지 않습니다."],
  ["합격을 보장하거나 예측하나요?", "아니요. 점수는 내가 남긴 기록을 근거로 계산한 준비 상태이고, 모든 점수에 근거가 함께 보입니다. 지원 여부는 본인이 정합니다."],
  ["IT 전공이 아니어도 쓸 수 있나요?", `네. 직무 ${ROLE_STATS.roles}개가 인문·사회·상경·공학·자연·의약·교육·예체능 전부를 다룹니다. 전시·오디션·자격증 시험·봉사 시간도 활동으로 관리합니다.`],
  ["모의 면접은 실제 기업 기출인가요?", `기업 ${COMPANIES.length}곳의 질문은 공개 면접 후기와 공식 채용 자료를 바탕으로 다시 쓴 연습 질문입니다. 기출이라고 하지 않고, 출처 종류를 질문마다 표시합니다.`],
  ["계정을 지우면 자료도 지워지나요?", "네. 설정에서 계정을 지우면 활동·문서·자소서·면접 기록이 모두 즉시 지워집니다."],
];

/**
 * 로그인 전에 보이는 소개 화면.
 * "이게 뭐 하는 서비스인지"를 가입 전에, 화면을 보고 알 수 있어야 한다.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [user, { error }] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/");
  const questionTotal = ROLE_STATS.questions + COMPANIES.reduce((s, c) => s + c.questionCount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <CaveroMark className="h-7 w-7 text-[#0F2338] dark:text-foreground" />
            <span className="text-base font-bold tracking-[0.18em]">CAVERO</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="소개 메뉴">
            <a href="#how" className="hover:text-foreground">
              쓰는 법
            </a>
            <a href="#interview" className="hover:text-foreground">
              모의 면접
            </a>
            <a href="#pricing" className="hover:text-foreground">
              요금
            </a>
            <a href="#faq" className="hover:text-foreground">
              자주 묻는 질문
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              로그인
            </Link>
            <Link href="/signup" className="hidden sm:block">
              <Button size="sm">무료로 시작하기</Button>
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <p className="mx-auto mt-4 max-w-6xl px-4 text-sm text-destructive" role="alert">
          {error === "demo-limit"
            ? "둘러보기를 너무 자주 열었습니다. 잠시 뒤에 다시 시도하거나 바로 가입해 주세요."
            : "둘러보기 계정을 만들지 못했습니다. 잠시 뒤에 다시 시도해 주세요."}
        </p>
      )}

      {/* 무엇을 해주는 서비스인가 */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="text-sm font-semibold text-primary">대학생 취업 준비 · 무료</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            지원할 곳 고르기부터
            <br />
            모의 면접까지, 한 곳에서
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            공모전·대외활동·인턴·채용 공고를 붙여넣으면 마감일과 제출 서류가 자동으로 정리됩니다. 목표 직무를 기준으로 지금
            지원할 만한지, 무엇이 부족한지 알려 주고, 자기소개서 첨삭과 AI 모의 면접까지 이어집니다.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/signup">
              <Button size="lg">
                무료로 시작하기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="/demo" rel="nofollow">
              <Button size="lg" variant="outline">
                가입 없이 둘러보기
              </Button>
            </a>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {["신용카드 없이 가입", "학교 이메일 아니어도 됩니다", "언제든 내 자료를 내려받고 계정을 지울 수 있어요"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ProductPreview />
      </section>

      {/* 숫자로 보는 범위 */}
      <section className="border-y bg-secondary/40 dark:bg-secondary/20">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-4">
          {[
            [`${ROLE_STATS.roles}개`, "면접 직무"],
            [`${Math.floor(questionTotal / 100) * 100}개+`, "면접 연습 질문"],
            [`${COMPANIES.length}곳`, "기업·공공기관 면접 정보"],
            ["8개 계열", "인문부터 예체능까지"],
          ].map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-bold tracking-tight">{n}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 어떻게 쓰나 */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">이렇게 씁니다</h2>
        <p className="mt-1 text-sm text-muted-foreground">공고 하나에서 시작해 면접까지, 같은 흐름 안에서 이어집니다.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          {[
            { title: "공고 링크를 붙여넣습니다", body: "마감일·지원 자격·제출 서류·평가 기준을 읽어 활동을 만들어 둡니다. 직접 입력해도 됩니다." },
            { title: "지원할지 판단합니다", body: "내 경험과 공고가 요구하는 것을 비교해 지원·보강·비추천과 그 이유, 대신 할 일을 알려줍니다." },
            { title: "자소서를 쓰고 첨삭받습니다", body: "문항별로 쓰고 첨삭받고, 예전에 쓴 비슷한 문항의 답을 찾아 다시 씁니다. 마감 전에 알림이 옵니다." },
            { title: "모의 면접으로 마무리합니다", body: "공고와 내 자소서를 읽은 면접관 3명이 질문하고 꼬리질문으로 파고듭니다. 끝나면 고칠 점을 알려줍니다." },
          ].map((item, i) => (
            <li key={item.title} className="rounded-lg border bg-card p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 모의 면접 */}
      <section id="interview" className="scroll-mt-20 border-y bg-[#0F2338] py-16 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <InterviewRoomPreview className="shadow-2xl" />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold text-sky-300">AI 모의 면접</p>
            <h2 className="mt-2 text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
              답을 들어야 할 수 있는 질문,
              <br />
              꼬리질문까지 연습합니다
            </h2>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-slate-200">
              {[
                "인사팀·면접위원장·실무진 3명이 질문 유형에 따라 번갈아 묻습니다. 소리로 듣고 말로 답할 수도 있습니다.",
                "\"팀에서 했다\"고 하면 내 역할을, 숫자를 말하면 어떻게 쟀는지를 묻습니다. 질문과 다른 답은 바로 짚습니다.",
                "지원한 공고와 내가 쓴 자소서 문장을 근거로 묻는 서류 기반 면접. 서류와 답이 어긋나면 알려줍니다.",
                "끝나면 6개 항목 점수, 가장 먼저 고칠 것, 이렇게 바꿔 말해 보기. 같은 질문에 다시 답해 점수를 비교합니다.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 무엇이 들어 있나 */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">들어 있는 기능</h2>
        <ul className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          {[
            { icon: Link2, title: "공고 링크 자동 정리", body: "주소만 넣으면 마감일과 제출물이 채워집니다." },
            { icon: Rss, title: "공고 자동 수집", body: "자주 보는 사이트를 등록하면 새 공고를 찾아 알려줍니다." },
            { icon: Crosshair, title: "지원 적합도", body: "지금의 나에게 좋은 기회인지 근거와 함께 판단합니다." },
            { icon: Compass, title: "커리어 분석", body: "목표 직무 대비 부족한 역량과 오늘 할 한 걸음을 고릅니다." },
            { icon: PenLine, title: "자기소개서", body: "문항별로 쓰고 첨삭받고, 예전 답변을 찾아 다시 씁니다." },
            { icon: Mic, title: "AI 모의 면접", body: "꼬리질문, 항목별 피드백, 기업·직무별 질문 은행." },
            { icon: Bell, title: "마감 알림", body: "D-7·3·1·당일에 앱·브라우저·캘린더로 알려줍니다." },
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

      {/* 모든 전공 */}
      <section className="border-y bg-secondary/40 py-16 dark:bg-secondary/20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight">IT 전공만을 위한 서비스가 아닙니다</h2>
          <p className="mt-1 text-sm text-muted-foreground">계열을 고르면 그 계열의 직무와 활동, 면접 질문을 기준으로 판단합니다.</p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FIELDS.map(([field, roles]) => (
              <li key={field} className="rounded-lg border bg-card px-4 py-3">
                <p className="text-sm font-semibold">{field}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{roles}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 요금 */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">요금</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          지금은 <strong className="text-foreground">전부 무료</strong>입니다. 아래는 앞으로의 계획입니다.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            { name: "무료", badge: "지금 이용 중", key: "free" as const, highlight: true },
            { name: "Pro", badge: "예정", key: "pro" as const, highlight: false },
          ].map((plan) => (
            <div key={plan.key} className={`rounded-xl border bg-card p-5 ${plan.highlight ? "border-primary/50 shadow-sm" : ""}`}>
              <p className="flex items-center gap-2 text-base font-semibold">
                {plan.name}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${plan.highlight ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {plan.badge}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {PLAN_FEATURES.map((row) => (
                  <li key={row.label} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="shrink-0 text-right font-medium">{row[plan.key]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">{PLAN_NOTE}</p>
      </section>

      {/* 솔직한 안내 */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-lg border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">합격을 예측하지 않습니다.</strong> 점수와 판단은 내가 남긴 기록을 근거로 계산한 &ldquo;준비
            상태&rdquo;일 뿐입니다. 지원 여부는 본인이 정합니다.
          </p>
          <p className="mt-2">
            내가 올린 공고문·자기소개서는 내 계정에서만 보입니다. AI 분석은 내가 버튼을 눌렀을 때만 실행됩니다. 자세한 내용은{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              개인정보처리방침
            </Link>
            에 적어두었습니다.
          </p>
        </div>
      </section>

      {/* 자주 묻는 질문 */}
      <section id="faq" className="scroll-mt-20 border-t py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-2xl font-bold tracking-tight">자주 묻는 질문</h2>
          <div className="mt-6 divide-y rounded-lg border">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  {q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-secondary/40 py-16 dark:bg-secondary/20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight">지금 챙겨야 할 마감이나 면접이 있나요?</h2>
          <p className="mt-2 text-sm text-muted-foreground">공고 링크 하나만 있으면 1분 안에 정리되고, 바로 그 공고로 면접 연습을 할 수 있습니다.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">
                무료로 시작하기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="/demo" rel="nofollow">
              <Button size="lg" variant="outline">
                가입 없이 둘러보기
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Cavero</span>
          <Link href="/terms" className="hover:text-foreground">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            개인정보처리방침
          </Link>
          {process.env.CONTACT_EMAIL && (
            <a href={`mailto:${process.env.CONTACT_EMAIL}`} className="hover:text-foreground">
              문의 {process.env.CONTACT_EMAIL}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
