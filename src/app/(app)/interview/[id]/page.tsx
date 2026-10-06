import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, activities, mockInterviews } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { buildPanel } from "@/services/mock-interview/panel";
import { toRoomView } from "@/services/mock-interview/view";
import type { Interview } from "@/services/mock-interview/types";
import { InterviewRoom } from "@/components/mock-interview/interview-room";
import { InterviewResult } from "@/components/mock-interview/interview-result";

export const metadata: Metadata = { title: "모의 면접" };

export default async function MockInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const row = (
    await db
      .select()
      .from(mockInterviews)
      .where(and(eq(mockInterviews.id, id), eq(mockInterviews.userId, user.id)))
      .limit(1)
  )[0];
  if (!row) notFound();

  let interview: Interview;
  try {
    interview = JSON.parse(row.data) as Interview;
  } catch {
    notFound();
  }

  const activity = row.activityId
    ? ((
        await db
          .select({ id: activities.id, name: activities.name })
          .from(activities)
          .where(and(eq(activities.id, row.activityId), eq(activities.userId, user.id)))
          .limit(1)
      )[0] ?? null)
    : null;

  const title = `${row.companyName ? `${row.companyName} · ` : ""}${row.position} 면접`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/interview" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 모의 면접
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {!interview.completed && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            실제 면접처럼 점수는 끝나고 보여 드립니다. 창을 닫아도 이어서 할 수 있습니다.
          </p>
        )}
      </div>
      {interview.completed ? (
        <InterviewResult interview={interview} activity={activity} companyName={row.companyName} />
      ) : (
        <InterviewRoom
          initial={toRoomView(interview, row)}
          panel={buildPanel({ position: interview.config.position, roleId: interview.config.roleId, customRole: interview.config.customRole })}
          label={row.companyName ? `${row.companyName} 모의면접` : "모의면접"}
        />
      )}
    </div>
  );
}
