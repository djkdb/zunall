"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateActivityStatus } from "@/actions/activities";
import { Select } from "@/components/ui/select";
import { ACTIVITY_STATUSES } from "@/lib/constants";

/** 활동 상세 헤더에서 바로 상태를 바꾸는 셀렉트 */
export function StatusSelect({ activityId, status }: { activityId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await updateActivityStatus(activityId, next);
          router.refresh();
        });
      }}
      className="h-8 w-auto min-w-28 text-xs font-medium"
      aria-label="활동 상태 변경"
    >
      {Object.entries(ACTIVITY_STATUSES).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </Select>
  );
}
