import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getProviderName } from "@/services/ai/provider";
import { NOTIFY_THRESHOLDS } from "@/lib/constants";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await requireUser();
  const provider = getProviderName();

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
        </CardContent>
      </Card>

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
          <CardTitle>알림</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            마감일 기준{" "}
            {NOTIFY_THRESHOLDS.map((d) => (d === 0 ? "당일" : `D-${d}`)).join(" / ")}에 앱 내부
            알림이 자동 생성됩니다. 이메일·브라우저 푸시·카카오톡 연동은 알림 서비스 모듈(
            <code className="rounded bg-secondary px-1">services/notification</code>)을 확장해
            추가할 수 있도록 설계되어 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
