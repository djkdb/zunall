"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateSubmissionStatus } from "@/actions/submissions";
import { Select } from "@/components/ui/select";
import { SUBMISSION_STATUSES } from "@/lib/constants";

export function SubmissionStatusSelect({
  submissionId,
  status,
}: {
  submissionId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await updateSubmissionStatus(submissionId, next);
          router.refresh();
        });
      }}
      className="h-7 w-auto min-w-24 text-xs"
      aria-label="제출물 상태 변경"
    >
      {Object.entries(SUBMISSION_STATUSES).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </Select>
  );
}
