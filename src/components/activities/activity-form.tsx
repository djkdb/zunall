"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { createActivity, updateActivity } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
  IMPORTANCE_LEVELS,
  ACTIVITY_COLORS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActivityRow } from "@/lib/db";

const formSchema = z.object({
  name: z.string().trim().min(1, "활동명을 입력해주세요.").max(120),
  organizer: z.string().max(120).optional(),
  type: z.string(),
  status: z.string(),
  importance: z.string(),
  color: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  applyDeadline: z.string().optional(),
  submitDeadline: z.string().optional(),
  announceDate: z.string().optional(),
  link: z.string().max(500).optional(),
  contact: z.string().max(120).optional(),
  memo: z.string().max(2000).optional(),
  tagsText: z.string().max(300).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function ActivityForm({
  activity,
  initialTags,
}: {
  activity?: ActivityRow;
  initialTags?: string[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const isEdit = !!activity;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: activity?.name ?? "",
      organizer: activity?.organizer ?? "",
      type: activity?.type ?? "contest",
      status: activity?.status ?? "interested",
      importance: activity?.importance ?? "medium",
      color: activity?.color ?? undefined,
      startDate: activity?.startDate ?? "",
      endDate: activity?.endDate ?? "",
      applyDeadline: activity?.applyDeadline ?? "",
      submitDeadline: activity?.submitDeadline ?? "",
      announceDate: activity?.announceDate ?? "",
      link: activity?.link ?? "",
      contact: activity?.contact ?? "",
      memo: activity?.memo ?? "",
      tagsText: initialTags?.join(", ") ?? "",
    },
  });

  const selectedColor = watch("color");

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const result = isEdit
      ? await updateActivity(activity.id, values)
      : await createActivity(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push(`/activities/${result.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">기본 정보</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">활동명 *</Label>
            <Input id="name" placeholder="예: 2026 네이버 AI 공모전" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="organizer">주최기관</Label>
            <Input id="organizer" placeholder="예: 네이버" {...register("organizer")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">활동 종류</Label>
            <Select id="type" {...register("type")}>
              {Object.entries(ACTIVITY_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">상태</Label>
            <Select id="status" {...register("status")}>
              {Object.entries(ACTIVITY_STATUSES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="importance">중요도</Label>
            <Select id="importance" {...register("importance")}>
              {Object.entries(IMPORTANCE_LEVELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>캘린더 색상</Label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                    selectedColor === color
                      ? "border-foreground"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`색상 ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">주요 일정</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">시작일</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">종료일</Label>
            <Input id="endDate" type="date" {...register("endDate")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="applyDeadline">접수(지원) 마감일</Label>
            <Input id="applyDeadline" type="date" {...register("applyDeadline")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="submitDeadline">결과물 제출 마감일</Label>
            <Input id="submitDeadline" type="date" {...register("submitDeadline")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announceDate">발표일</Label>
            <Input id="announceDate" type="date" {...register("announceDate")} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          마감일을 입력하면 캘린더 일정이 자동 등록되고 D-day 알림을 받게 됩니다.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">추가 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="link">활동 링크</Label>
            <Input id="link" type="url" placeholder="https://…" {...register("link")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact">담당자 / 문의처</Label>
            <Input id="contact" placeholder="예: 운영사무국 02-000-0000" {...register("contact")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tagsText">태그 (쉼표로 구분)</Label>
            <Input id="tagsText" placeholder="예: AI, 공모전, 포트폴리오" {...register("tagsText")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" rows={4} placeholder="자유롭게 메모를 남겨보세요." {...register("memo")} />
          </div>
        </div>
      </section>

      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "저장" : "활동 만들기"}
        </Button>
      </div>
    </form>
  );
}
