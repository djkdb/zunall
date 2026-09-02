import "server-only";
import { eq } from "drizzle-orm";
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
  careerEvidence,
  roadmapItems,
} from "@/lib/db";
import { newId } from "@/lib/utils";
import { BACKUP_VERSION, type BackupFile } from "./export";

/**
 * 백업 가져오기.
 *
 * 기존 데이터를 지우지 않고 '추가'한다. 모든 ID 는 새로 발급해 충돌을 원천 차단하고,
 * 활동 ↔ 일정/작업/문서 같은 관계는 옛 ID → 새 ID 대응표로 이어 붙인다.
 * 파일 원본은 백업에 없으므로 문서는 메타데이터와 추출 텍스트만 복원된다.
 */
export interface ImportResult {
  ok: boolean;
  error?: string;
  counts: Record<string, number>;
}

type Row = Record<string, unknown>;

export async function importUserData(userId: string, file: unknown): Promise<ImportResult> {
  const backup = file as Partial<BackupFile>;
  if (!backup || backup.app !== "cavero" || typeof backup.version !== "number") {
    return { ok: false, error: "Cavero 백업 파일이 아닙니다.", counts: {} };
  }
  if (backup.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `더 새로운 형식의 백업입니다 (v${backup.version}). 앱을 업데이트해주세요.`,
      counts: {},
    };
  }
  const data = backup.data ?? {};
  const counts: Record<string, number> = {};
  const now = Date.now();

  /** 옛 ID → 새 ID */
  const idMap = new Map<string, string>();
  const remap = (oldId: unknown): string | null => {
    if (typeof oldId !== "string") return null;
    return idMap.get(oldId) ?? null;
  };

  const rowsOf = (key: string): Row[] => (Array.isArray(data[key]) ? (data[key] as Row[]) : []);

  // 1) 활동 (다른 모든 것의 기준)
  const activityRows = rowsOf("activities").map((row) => {
    const id = newId();
    idMap.set(String(row.id), id);
    return { ...row, id, userId, createdAt: Number(row.createdAt) || now, updatedAt: now };
  });
  if (activityRows.length > 0) {
    await db.insert(activities).values(activityRows as never);
    counts.activities = activityRows.length;
  }

  // 2) 태그 (이름이 같으면 기존 태그를 재사용)
  const existingTags = await db.select().from(tags).where(eq(tags.userId, userId));
  const tagByName = new Map(existingTags.map((t) => [t.name, t.id]));
  for (const row of rowsOf("tags")) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    let tagId = tagByName.get(name);
    if (!tagId) {
      tagId = newId();
      await db.insert(tags).values({ id: tagId, userId, name });
      tagByName.set(name, tagId);
      counts.tags = (counts.tags ?? 0) + 1;
    }
    idMap.set(String(row.id), tagId);
  }
  for (const row of rowsOf("activityTags")) {
    const activityId = remap(row.activityId);
    const tagId = remap(row.tagId);
    if (!activityId || !tagId) continue;
    await db.insert(activityTags).values({ activityId, tagId }).onConflictDoNothing();
  }

  // 3) 활동에 매달린 것들
  const simple: Array<[string, typeof events | typeof tasks | typeof notes | typeof evaluationCriteria]> = [
    ["events", events],
    ["tasks", tasks],
    ["notes", notes],
    ["evaluationCriteria", evaluationCriteria],
  ];
  for (const [key, table] of simple) {
    const rows = rowsOf(key)
      .map((row) => {
        const id = newId();
        idMap.set(String(row.id), id);
        const activityId = row.activityId === null ? null : remap(row.activityId);
        // 활동에 속했는데 그 활동을 못 찾으면 버린다 (고아 데이터 방지)
        if (row.activityId && !activityId) return null;
        return { ...row, id, userId, activityId };
      })
      .filter(Boolean) as Row[];
    if (rows.length > 0) {
      await db.insert(table as never).values(rows as never);
      counts[key] = rows.length;
    }
  }

  // 4) 문서 (파일 원본은 없으므로 저장 경로를 비운다)
  const docRows = rowsOf("documents")
    .map((row) => {
      const activityId = remap(row.activityId);
      if (!activityId) return null;
      const id = newId();
      idMap.set(String(row.id), id);
      const groupId = remap(row.groupId) ?? id;
      return { ...row, id, userId, activityId, groupId, storagePath: "" };
    })
    .filter(Boolean) as Row[];
  if (docRows.length > 0) {
    await db.insert(documents).values(docRows as never);
    counts.documents = docRows.length;
  }

  // 5) 제출물 → 버전
  const subRows = rowsOf("submissions")
    .map((row) => {
      const activityId = remap(row.activityId);
      if (!activityId) return null;
      const id = newId();
      idMap.set(String(row.id), id);
      return { ...row, id, userId, activityId };
    })
    .filter(Boolean) as Row[];
  if (subRows.length > 0) {
    await db.insert(submissions).values(subRows as never);
    counts.submissions = subRows.length;
  }
  const versionRows = rowsOf("submissionVersions")
    .map((row) => {
      const submissionId = remap(row.submissionId);
      if (!submissionId) return null;
      return { ...row, id: newId(), userId, submissionId, documentId: remap(row.documentId) };
    })
    .filter(Boolean) as Row[];
  if (versionRows.length > 0) {
    await db.insert(submissionVersions).values(versionRows as never);
    counts.submissionVersions = versionRows.length;
  }

  // 6) 자소서 문항 → 초안
  const questionRows = rowsOf("essayQuestions")
    .map((row) => {
      const activityId = remap(row.activityId);
      if (!activityId) return null;
      const id = newId();
      idMap.set(String(row.id), id);
      return { ...row, id, userId, activityId };
    })
    .filter(Boolean) as Row[];
  if (questionRows.length > 0) {
    await db.insert(essayQuestions).values(questionRows as never);
    counts.essayQuestions = questionRows.length;
  }
  const draftRows = rowsOf("essayDrafts")
    .map((row) => {
      const questionId = remap(row.questionId);
      if (!questionId) return null;
      return { ...row, id: newId(), userId, questionId };
    })
    .filter(Boolean) as Row[];
  if (draftRows.length > 0) {
    await db.insert(essayDrafts).values(draftRows as never);
    counts.essayDrafts = draftRows.length;
  }

  // 7) 회고
  const retroRows = rowsOf("retrospectives")
    .map((row) => {
      const activityId = remap(row.activityId);
      if (!activityId) return null;
      return { ...row, id: newId(), userId, activityId, updatedAt: now };
    })
    .filter(Boolean) as Row[];
  if (retroRows.length > 0) {
    await db.insert(retrospectives).values(retroRows as never);
    counts.retrospectives = retroRows.length;
  }

  // 8) 커리어 근거·로드맵 (목표/프로필은 현재 것을 유지한다)
  const evidenceRows = rowsOf("careerEvidence").map((row) => ({
    ...row,
    id: newId(),
    userId,
    sourceId: remap(row.sourceId),
  }));
  if (evidenceRows.length > 0) {
    await db.insert(careerEvidence).values(evidenceRows as never);
    counts.careerEvidence = evidenceRows.length;
  }
  const roadmapRows = rowsOf("roadmapItems").map((row) => ({ ...row, id: newId(), userId }));
  if (roadmapRows.length > 0) {
    await db.insert(roadmapItems).values(roadmapRows as never);
    counts.roadmapItems = roadmapRows.length;
  }

  return { ok: true, counts };
}
