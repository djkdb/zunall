import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/admin";
import { getAdminMetrics } from "@/services/admin/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STUDY_FIELDS, type StudyField } from "@/lib/career-constants";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/constants";

export const metadata: Metadata = { title: "운영 지표" };

/**
 * 운영자용 지표.
 * 얼마나 쓰이는지 모르면 무엇을 고쳐야 할지도 모른다. 합계만 보고,
 * 개인이 쓴 내용은 한 글자도 표시하지 않는다.
 */
export default async function AdminPage() {
  const user = await requireUser();
  // 권한이 없으면 이런 화면이 있다는 사실도 알리지 않는다
  if (!isAdmin(user.email)) notFound();

  const m = await getAdminMetrics();
  const percent = (part: number) =>
    m.usersTotal > 0 ? `가입자의 ${Math.round((part / m.usersTotal) * 100)}%` : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">운영 지표</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          합계만 봅니다. 개인이 쓴 내용은 표시하지 않습니다. 둘러보기 계정 {m.demoUsers}개는 빼고
          셌습니다.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">사용자</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Metric label="전체 가입" value={m.usersTotal} />
          <Metric label="최근 7일 가입" value={m.users7d} />
          <Metric label="최근 30일 가입" value={m.users30d} />
          <Metric label="구글로 가입" value={m.googleUsers} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">얼마나 쓰는가</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Metric
            label="활동을 1개 이상 등록"
            value={m.usersWithActivity}
            sub={percent(m.usersWithActivity)}
          />
          <Metric label="커리어 정보 입력 완료" value={m.onboarded} sub={percent(m.onboarded)} />
          <Metric label="등록된 활동" value={m.activities} />
          <Metric label="AI 분석 실행" value={m.aiDone} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">기능별</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Metric label="자기소개서 답변" value={m.essayDrafts} />
          <Metric label="면접 질문" value={m.interviewQuestions} />
          <Metric label="돌아보기 기록" value={m.retrospectives} />
          <Metric label="공유한 포트폴리오" value={m.sharedPortfolios} />
          <Metric label="공고 수집 사이트" value={m.noticeSources} />
          <Metric label="수집된 공고" value={m.noticeItems} />
          <Metric label="알림 받는 기기" value={m.pushDevices} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Breakdown
          title="전공 계열"
          rows={m.fields}
          label={(key) => STUDY_FIELDS[key as StudyField] ?? key}
        />
        <Breakdown
          title="활동 종류"
          rows={m.types}
          label={(key) => ACTIVITY_TYPES[key as ActivityType] ?? key}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString("ko-KR")}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  label,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
  label: (key: string) => string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 없습니다.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-muted-foreground">{label(row.key)}</span>
                  <span className="font-semibold tabular-nums">{row.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${total > 0 ? (row.count / total) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
