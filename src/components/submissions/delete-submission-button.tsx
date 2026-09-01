"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSubmission } from "@/actions/submissions";
import { Button } from "@/components/ui/button";

export function DeleteSubmissionButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="ghost"
      size="iconSm"
      disabled={pending}
      aria-label="제출물 삭제"
      onClick={() => {
        if (!window.confirm("이 제출물과 모든 버전 파일을 삭제할까요?")) return;
        startTransition(async () => {
          await deleteSubmission(submissionId);
          router.refresh();
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}
