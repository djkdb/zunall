"use client";

import * as React from "react";
import { Loader2, Save, Check } from "lucide-react";
import { saveNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";

export function NoteEditor({
  activityId,
  initialContent,
  updatedAt,
}: {
  activityId: string;
  initialContent: string;
  updatedAt: number | null;
}) {
  const [content, setContent] = React.useState(initialContent);
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const dirty = content !== initialContent && state !== "saved";

  async function handleSave() {
    setState("saving");
    setError(null);
    const result = await saveNote(activityId, content);
    if (!result.ok) {
      setState("error");
      setError(result.error);
      return;
    }
    setState("saved");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          이 활동에 대한 개인 메모입니다.
          {updatedAt && ` 마지막 저장: ${formatDateTime(updatedAt)}`}
        </p>
        <Button size="sm" onClick={handleSave} disabled={state === "saving" || !dirty}>
          {state === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {state === "saved" ? "저장됨" : "저장"}
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (state === "saved") setState("idle");
        }}
        rows={16}
        placeholder={
          "자유롭게 기록하세요.\n\n예)\n- 아이디어 브레인스토밍\n- 팀원 연락처\n- 참고 링크\n- 회의록"
        }
        className="font-mono text-sm leading-relaxed"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
