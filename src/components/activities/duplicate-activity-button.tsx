"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { duplicateActivity } from "@/actions/activities";
import { Button } from "@/components/ui/button";

/** 같은 공모전의 다음 회차를 준비할 때, 뼈대만 복사해 새 활동을 만든다 */
export function DuplicateActivityButton({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="활동 복제"
        title="일정·작업·평가 기준을 그대로 복사해 새 활동 만들기"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await duplicateActivity(activityId);
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/activities/${result.id}`);
          router.refresh();
        }}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  );
}
