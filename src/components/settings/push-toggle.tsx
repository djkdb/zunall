"use client";

import * as React from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import {
  countPushDevices,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/actions/push";
import { Button } from "@/components/ui/button";

/**
 * 브라우저 알림 켜기/끄기.
 * 앱이 닫혀 있어도 마감 알림이 오게 하려면 이 기기에서 한 번 허용해야 한다.
 */
export function PushToggle({
  configured,
  publicKey,
  initialDevices,
}: {
  configured: boolean;
  publicKey: string | null;
  initialDevices: number;
}) {
  const [devices, setDevices] = React.useState(initialDevices);
  const [enabled, setEnabled] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [supported, setSupported] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setPending(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("브라우저에서 알림을 거부했습니다. 주소창 옆 자물쇠 아이콘에서 허용으로 바꿔주세요.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey!,
      });
      const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      const result = await savePushSubscription({
        endpoint: json.endpoint ?? subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        setMessage(result.error ?? "등록에 실패했습니다.");
        return;
      }
      setEnabled(true);
      setDevices(await countPushDevices());
      setMessage("이 기기에서 알림을 받습니다.");
    } catch (error) {
      setMessage(`알림을 켜지 못했습니다: ${String(error).slice(0, 90)}`);
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setDevices(await countPushDevices());
      setMessage("이 기기에서 알림을 껐습니다.");
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        서버에 <code className="rounded bg-secondary px-1">VAPID_PUBLIC_KEY</code>·
        <code className="rounded bg-secondary px-1">VAPID_PRIVATE_KEY</code> 가 없어 브라우저 알림이
        꺼져 있습니다. <code className="rounded bg-secondary px-1">npx tsx scripts/gen-vapid.ts</code>{" "}
        로 키를 만들어 등록하면 켜집니다.
      </p>
    );
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        이 브라우저는 웹 푸시를 지원하지 않습니다. iPhone 은 Safari 에서 &lsquo;홈 화면에 추가&rsquo; 후
        사용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {enabled ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={disable}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            이 기기 알림 끄기
          </Button>
        ) : (
          <Button size="sm" disabled={pending} onClick={enable}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            이 기기에서 알림 받기
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || devices === 0}
          onClick={async () => {
            setPending(true);
            const result = await sendTestPush();
            setPending(false);
            setMessage(result.ok ? "테스트 알림을 보냈습니다." : (result.error ?? "실패했습니다."));
          }}
        >
          <Send className="h-4 w-4" />
          테스트 알림
        </Button>
        <span className="text-xs text-muted-foreground">등록된 기기 {devices}개</span>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">
        마감 D-7·D-3·D-1·당일에 하루 한 번 요약 알림이 옵니다. iPhone 은 Safari 에서 공유 → &lsquo;홈
        화면에 추가&rsquo; 를 먼저 해야 알림을 받을 수 있습니다.
      </p>
    </div>
  );
}
