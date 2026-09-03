import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getActivity, getActivityTagNames } from "@/lib/queries";
import { ActivityForm } from "@/components/activities/activity-form";

export const metadata: Metadata = { title: "활동 수정" };

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const activity = await getActivity(user.id, id);
  if (!activity) notFound();

  const tagNames = await getActivityTagNames(user.id, activity.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">활동 수정</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{activity.name}</p>
      </div>
      <ActivityForm activity={activity} initialTags={tagNames} />
    </div>
  );
}
