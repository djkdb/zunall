"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Download } from "lucide-react";
import { deleteDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";

export function DocumentActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex items-center gap-0.5">
      <a
        href={`/api/files/${documentId}`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="다운로드"
        title="다운로드"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
      <Button
        variant="ghost"
        size="iconSm"
        disabled={pending}
        aria-label="파일 삭제"
        title="삭제"
        onClick={() => {
          if (!window.confirm("이 파일을 삭제할까요?")) return;
          startTransition(async () => {
            await deleteDocument(documentId);
            router.refresh();
          });
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
