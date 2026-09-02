"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Loader2 } from "lucide-react";
import { importBackup } from "@/actions/backup";
import { Button } from "@/components/ui/button";

/** 데이터 내보내기 / 가져오기 (잠금 없는 서비스를 위한 백업) */
export function BackupCard() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/export" download>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4" />
            내 데이터 내려받기
          </Button>
        </a>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          백업 가져오기
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setPending(true);
            setMessage(null);
            const result = await importBackup(await file.text());
            setPending(false);
            if (!result.ok) {
              setMessage(result.error ?? "가져오기에 실패했습니다.");
              return;
            }
            const summary = Object.entries(result.counts)
              .map(([key, count]) => `${LABELS[key] ?? key} ${count}건`)
              .join(", ");
            setMessage(summary ? `가져왔습니다 — ${summary}` : "가져올 데이터가 없었습니다.");
            router.refresh();
          }}
        />
      </div>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <p className="text-xs leading-relaxed text-muted-foreground">
        활동·일정·작업·문서 기록·제출물·자소서·회고·커리어 근거를 JSON 한 파일로 내려받습니다.
        가져오기는 <strong>기존 데이터를 지우지 않고 추가</strong>하며, 모든 ID 를 새로 발급해
        충돌 없이 합칩니다. 업로드한 <strong>파일 원본은 백업에 포함되지 않고</strong> 문서 정보와
        추출된 텍스트만 저장됩니다.
      </p>
    </div>
  );
}

const LABELS: Record<string, string> = {
  activities: "활동",
  tags: "태그",
  events: "일정",
  tasks: "작업",
  documents: "문서",
  submissions: "제출물",
  submissionVersions: "제출 버전",
  evaluationCriteria: "평가 기준",
  notes: "메모",
  essayQuestions: "자소서 문항",
  essayDrafts: "자소서 답변",
  retrospectives: "회고",
  careerEvidence: "커리어 근거",
  roadmapItems: "로드맵",
};
