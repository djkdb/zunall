"use client";

import * as React from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteActivity } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DeleteActivityButton({
  activityId,
  activityName,
}: {
  activityId: string;
  activityName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="활동 삭제">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="활동 삭제">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">“{activityName}”</span> 활동과 관련된
          일정, 작업, 파일, 제출물, AI 리뷰가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => deleteActivity(activityId))}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            삭제
          </Button>
        </div>
      </Dialog>
    </>
  );
}
