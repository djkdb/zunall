import "server-only";
import { and, eq } from "drizzle-orm";
import { db, activities, careerEvidence } from "@/lib/db";
import { newId } from "@/lib/utils";
import { detectSkills, normalizeSkillNames } from "./skill-detect";
import type { EvidenceKind } from "@/lib/career-constants";

/** 활동 종류 → 근거 종류 매핑 */
function evidenceKindFor(activityType: string, status: string): EvidenceKind {
  if (status === "won") return "award";
  switch (activityType) {
    case "project":
      return "project";
    case "education":
      return "education";
    case "intern":
      return "work";
    case "opensource":
      return "github";
    default:
      return "activity";
  }
}

/**
 * 기존 활동 데이터를 Career Evidence로 임포트한다.
 * - 수상 활동 → 수상 근거
 * - 진행/완료 활동 → 활동 근거
 * - 활동의 사용 기술/태그/메모에서 스킬을 감지해 연결
 * 이미 임포트된 활동(sourceId 일치)은 건너뛴다. 반환: 새로 만든 근거 수.
 */
export async function importEvidenceFromActivities(userId: string): Promise<number> {
  const acts = await db.select().from(activities).where(eq(activities.userId, userId)).all();
  let created = 0;

  for (const act of acts) {
    if (act.status === "interested" || act.status === "planned") continue;

    const existing = await db
      .select({ id: careerEvidence.id })
      .from(careerEvidence)
      .where(
        and(
          eq(careerEvidence.userId, userId),
          eq(careerEvidence.sourceType, "activity"),
          eq(careerEvidence.sourceId, act.id),
        ),
      )
      .get();
    if (existing) continue;

    const kind = evidenceKindFor(act.type, act.status);
    const detected = detectSkills(
      [act.name, act.memo ?? "", act.role ?? "", act.learned ?? "", act.achievement ?? ""].join(" "),
      5,
    );
    const declared = normalizeSkillNames((act.skills ?? "").split(/[,/·]/));
    const skills = Array.from(new Set([...declared, ...detected])).slice(0, 6);

    const descriptionParts = [
      act.organizer ? `주최: ${act.organizer}` : null,
      act.role ? `역할: ${act.role}` : null,
      act.achievement ? `성과: ${act.achievement}` : null,
    ].filter(Boolean);

    await db.insert(careerEvidence)
      .values({
        id: newId(),
        userId,
        kind,
        title: act.status === "won" ? `${act.name} 수상` : act.name,
        description: descriptionParts.join(" · ") || null,
        url: act.link,
        skills: JSON.stringify(skills),
        sourceType: "activity",
        sourceId: act.id,
        createdAt: Date.now(),
      })
      .run();
    created++;
  }

  return created;
}
