import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getProviderName, providerFallbackReason } from "@/services/ai/provider";
import { storageBackend } from "@/lib/storage";
import { databaseKind } from "@/lib/db/info";
import { NOTIFY_THRESHOLDS } from "@/lib/constants";
import { PushToggle } from "@/components/settings/push-toggle";
import { BackupCard } from "@/components/settings/backup-card";
import { StudyProfileCard } from "@/components/settings/study-profile-card";
import { PasswordCard } from "@/components/settings/password-card";
import { DangerCard } from "@/components/settings/danger-card";
import { getPushEnv, countPushDevices } from "@/actions/push";
import { getCareerContext } from "@/lib/career-queries";

const STORAGE_LABEL: Record<ReturnType<typeof storageBackend>, string> = {
  db: "DB 저장 (document_blobs)",
  r2: "Cloudflare R2",
  supabase: "Supabase Storage",
  local: "로컬 파일시스템",
};

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await requireUser();
  const provider = getProviderName();
  const providerNotice = providerFallbackReason();
  const storage = storageBackend();
  const database = databaseKind();
  const [pushEnv, pushDevices, careerCtx] = await Promise.all([
    getPushEnv(),
    countPushDevices(),
    getCareerContext(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">설정</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">이름: </span>
            {user.name}
          </p>
          <p>
            <span className="text-muted-foreground">이메일: </span>
            {user.email}
          </p>
          <p className="pt-1 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground hover:underline">
              이용약관
            </Link>
            {" · "}
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              개인정보처리방침
            </Link>
          </p>
        </CardContent>
      </Card>

      <StudyProfileCard
        initialField={careerCtx.studyField}
        initialMajor={careerCtx.profile?.major ?? null}
        initialRoleKey={careerCtx.profile?.roleKey ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>화면</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">다크 모드 전환</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">현재 AI Provider</span>
            <Badge variant={provider === "claude" ? "default" : "secondary"}>{provider}</Badge>
          </div>
          {providerNotice && (
            <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              {providerNotice}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            서버 환경변수 <code className="rounded bg-secondary px-1">AI_PROVIDER</code>로
            설정합니다. <code className="rounded bg-secondary px-1">mock</code>은 Claude 없이
            동작하는 휴리스틱 분석, <code className="rounded bg-secondary px-1">claude</code>는
            서버에 설치된 Claude CLI 호출,{" "}
            <code className="rounded bg-secondary px-1">anthropic</code>은 Anthropic API 직접
            호출(배포 환경 권장, <code className="rounded bg-secondary px-1">ANTHROPIC_API_KEY</code>{" "}
            필요)입니다. 자세한 설정은 프로젝트의{" "}
            <code className="rounded bg-secondary px-1">.env.example</code>을 참고하세요.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>데이터 저장소</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">파일 스토리지</span>
            <Badge variant={storage === "local" ? "secondary" : "default"}>{STORAGE_LABEL[storage]}</Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            기본값은 <strong>DB 저장</strong>입니다 — 업로드한 파일이{" "}
            <code className="rounded bg-secondary px-1">document_blobs</code> 테이블에 들어가므로
            별도의 오브젝트 스토리지 서비스가 필요 없습니다. Cloudflare R2 바인딩(
            <code className="rounded bg-secondary px-1">BUCKET</code>)이 있거나{" "}
            <code className="rounded bg-secondary px-1">SUPABASE_URL</code>·
            <code className="rounded bg-secondary px-1">SUPABASE_SERVICE_ROLE_KEY</code> 가
            설정되면 자동으로 그쪽을 쓰고,{" "}
            <code className="rounded bg-secondary px-1">STORAGE_BACKEND</code> 로 직접 고정할 수도
            있습니다(<code className="rounded bg-secondary px-1">db</code> /{" "}
            <code className="rounded bg-secondary px-1">r2</code> /{" "}
            <code className="rounded bg-secondary px-1">supabase</code> /{" "}
            <code className="rounded bg-secondary px-1">local</code>).
          </p>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-muted-foreground">데이터베이스</span>
            <Badge variant="secondary">{database}</Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <code className="rounded bg-secondary px-1">DATABASE_URL</code> 이 있으면 해당
            PostgreSQL(Neon 등 무료 Postgres 포함)을, 없으면 설치가 필요 없는 내장 PGlite 를
            사용합니다. Cloudflare Workers 에서 Neon 주소를 쓰면 fetch 기반 HTTP 드라이버로 자동
            전환되며, <code className="rounded bg-secondary px-1">DB_DRIVER</code> 로 강제할 수
            있습니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>데이터 백업</CardTitle>
        </CardHeader>
        <CardContent>
          <BackupCard />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>알림</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <PushToggle
            configured={pushEnv.configured}
            publicKey={pushEnv.publicKey}
            initialDevices={pushDevices}
          />
          <p className="border-t border-border pt-3">
            마감일 기준{" "}
            {NOTIFY_THRESHOLDS.map((d) => (d === 0 ? "당일" : `D-${d}`)).join(" / ")}에 앱 내부
            알림이 자동 생성됩니다. 이메일·브라우저 푸시·카카오톡 연동은 알림 서비스 모듈(
            <code className="rounded bg-secondary px-1">services/notification</code>)을 확장해
            추가할 수 있도록 설계되어 있습니다.
          </p>
        </CardContent>
      </Card>

      <PasswordCard hasPassword={!!user.passwordHash} />

      <DangerCard email={user.email} />
    </div>
  );
}
