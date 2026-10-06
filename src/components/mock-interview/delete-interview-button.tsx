"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteMockInterview } from "@/actions/mock-interview";
import { Button } from "@/components/ui/button";

export function DeleteInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  async function remove() {
    if (!window.confirm("이 면접 기록을 지울까요? 답변과 피드백이 모두 사라집니다.")) return;
    setPending(true);
    const result = await deleteMockInterview(interviewId);
    setPending(false);
    if (result.ok) router.push("/interview");
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
      <Trash2 /> 기록 삭제
    </Button>
  );
}
