import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ActivityForm } from "@/components/activities/activity-form";

export const metadata: Metadata = { title: "새 활동" };

export default async function NewActivityPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">새 활동 만들기</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          공모전, 대외활동, 해커톤 등 참여할 활동의 정보를 입력하세요.
        </p>
      </div>
      <ActivityForm />
    </div>
  );
}
