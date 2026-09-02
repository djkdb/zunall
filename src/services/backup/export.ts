import "server-only";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  activities,
  activityTags,
  tags,
  events,
  tasks,
  documents,
  submissions,
  submissionVersions,
  evaluationCriteria,
  notes,
  essayQuestions,
  essayDrafts,
  retrospectives,
  careerGoals,
  careerProfiles,
  careerEvidence,
  userSkills,
  roadmapItems,
  opportunityAnalyses,
  users,
} from "@/lib/db";

/**
 * 내 데이터 전체 내보내기.
 *
 * 잠금 없는 서비스를 위한 백업이자 이사 수단이다.
 * 파일 원본(바이트)은 용량이 커서 기본으로 제외하고, 문서의 추출 텍스트는 포함한다.
 * (원본 파일은 각 문서의 내려받기 링크로 따로 받을 수 있다)
 */
export const BACKUP_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  app: "cavero";
  user: { name: string; email: string };
  data: Record<string, unknown[]>;
}

export async function exportUserData(userId: string): Promise<BackupFile> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];

  const acts = await db.select().from(activities).where(eq(activities.userId, userId));
  const activityIds = acts.map((a) => a.id);

  const byActivity = async <T extends { activityId: string }>(
    rows: Promise<T[]>,
  ): Promise<T[]> => (activityIds.length === 0 ? [] : rows);

  const docs = await db.select().from(documents).where(eq(documents.userId, userId));
  const subs = await db.select().from(submissions).where(eq(submissions.userId, userId));
  const subIds = subs.map((s) => s.id);
  const questions = await db.select().from(essayQuestions).where(eq(essayQuestions.userId, userId));

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "cavero",
    user: { name: user?.name ?? "", email: user?.email ?? "" },
    data: {
      activities: acts,
      tags: await db.select().from(tags).where(eq(tags.userId, userId)),
      activityTags:
        activityIds.length > 0
          ? await db.select().from(activityTags).where(inArray(activityTags.activityId, activityIds))
          : [],
      events: await db.select().from(events).where(eq(events.userId, userId)),
      tasks: await db.select().from(tasks).where(eq(tasks.userId, userId)),
      // 파일 메타데이터와 추출 텍스트만 (원본 바이트 제외)
      documents: docs.map(({ ...doc }) => doc),
      submissions: subs,
      submissionVersions:
        subIds.length > 0
          ? await db
              .select()
              .from(submissionVersions)
              .where(inArray(submissionVersions.submissionId, subIds))
          : [],
      evaluationCriteria: await byActivity(
        db.select().from(evaluationCriteria).where(eq(evaluationCriteria.userId, userId)),
      ),
      notes: await db.select().from(notes).where(eq(notes.userId, userId)),
      essayQuestions: questions,
      essayDrafts: await db.select().from(essayDrafts).where(eq(essayDrafts.userId, userId)),
      retrospectives: await db.select().from(retrospectives).where(eq(retrospectives.userId, userId)),
      careerGoals: await db.select().from(careerGoals).where(eq(careerGoals.userId, userId)),
      careerProfiles: await db.select().from(careerProfiles).where(eq(careerProfiles.userId, userId)),
      careerEvidence: await db.select().from(careerEvidence).where(eq(careerEvidence.userId, userId)),
      userSkills: await db.select().from(userSkills).where(eq(userSkills.userId, userId)),
      roadmapItems: await db.select().from(roadmapItems).where(eq(roadmapItems.userId, userId)),
      opportunityAnalyses: await db
        .select()
        .from(opportunityAnalyses)
        .where(eq(opportunityAnalyses.userId, userId)),
    },
  };
}
