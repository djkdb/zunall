import { and, eq } from "drizzle-orm";
import { db, notes, type ActivityRow } from "@/lib/db";
import { NoteEditor } from "@/components/activities/note-editor";

export function NotesTab({ activity, userId }: { activity: ActivityRow; userId: string }) {
  const note = db
    .select()
    .from(notes)
    .where(and(eq(notes.activityId, activity.id), eq(notes.userId, userId)))
    .get();

  return (
    <NoteEditor
      activityId={activity.id}
      initialContent={note?.content ?? ""}
      updatedAt={note?.updatedAt ?? null}
    />
  );
}
