"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      <CheckCheck className="h-4 w-4" /> 모두 읽음
    </Button>
  );
}

export function NotificationItemActions({
  notificationId,
  read,
}: {
  notificationId: string;
  read: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {!read && (
        <Button
          variant="ghost"
          size="iconSm"
          disabled={pending}
          aria-label="읽음 처리"
          title="읽음 처리"
          onClick={() =>
            startTransition(async () => {
              await markNotificationRead(notificationId);
              router.refresh();
            })
          }
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="iconSm"
        disabled={pending}
        aria-label="알림 삭제"
        title="삭제"
        onClick={() =>
          startTransition(async () => {
            await deleteNotification(notificationId);
            router.refresh();
          })
        }
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
