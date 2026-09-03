import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ActivityForm } from "@/components/activities/activity-form";
import { QuickCreate } from "@/components/activities/quick-create";
import { FieldActivityHints } from "@/components/activities/field-hints";
import { getCareerContext } from "@/lib/career-queries";

export const metadata: Metadata = { title: "새 활동" };

export default async function NewActivityPage() {
  const user = await requireUser();
  const { studyField } = await getCareerContext(user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">새 활동 만들기</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          공고 링크나 공고문을 넣으면 대부분 자동으로 채워집니다. 직접 입력해도 됩니다.
        </p>
      </div>

      <QuickCreate />

      {studyField && <FieldActivityHints studyField={studyField} />}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">또는 직접 입력</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <ActivityForm />
    </div>
  );
}
