"use client";

import { Lightbulb } from "lucide-react";
import { FIELD_ACTIVITY_HINTS, STUDY_FIELDS, type StudyField } from "@/lib/career-constants";
import { ACTIVITY_TYPES } from "@/lib/constants";

/**
 * 전공 계열에 맞는 추천 활동.
 * "무엇부터 등록해야 할지 모르겠다"는 사용자에게 자기 계열에서 흔한 유형을 먼저 보여준다.
 * 누르면 아래 입력 폼의 유형이 그 값으로 맞춰진다.
 */
export function FieldActivityHints({ studyField }: { studyField: StudyField }) {
  const hints = FIELD_ACTIVITY_HINTS[studyField];
  if (!hints || hints.length === 0) return null;

  function applyType(type: string) {
    const select = document.getElementById("type") as HTMLSelectElement | null;
    if (!select) return;
    select.value = type;
    // react-hook-form 이 값 변경을 알아채도록 이벤트를 직접 발생시킨다.
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="rounded-lg border bg-secondary/40 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Lightbulb className="h-4 w-4 text-primary" />
        {STUDY_FIELDS[studyField]} 계열에서 많이 하는 활동
      </p>
      <ul className="mt-2 space-y-1.5">
        {hints.map((hint) => (
          <li key={hint.label} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <button
              type="button"
              onClick={() => applyType(hint.type)}
              className="font-medium text-primary hover:underline"
            >
              {hint.label}
            </button>
            <span className="rounded-full bg-background px-1.5 text-[10px] text-muted-foreground">
              {ACTIVITY_TYPES[hint.type]}
            </span>
            <span className="text-xs text-muted-foreground">{hint.why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
