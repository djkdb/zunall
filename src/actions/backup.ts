"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { importUserData, type ImportResult } from "@/services/backup/import";

/** 백업 파일(JSON 문자열)을 받아 현재 계정에 추가한다 */
export async function importBackup(json: string): Promise<ImportResult> {
  const user = await requireUser();
  if (json.length > 20_000_000) {
    return { ok: false, error: "파일이 너무 큽니다 (20MB 제한).", counts: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "JSON 형식이 아닙니다.", counts: {} };
  }

  const result = await importUserData(user.id, parsed);
  if (result.ok) {
    revalidatePath("/activities");
    revalidatePath("/career");
    revalidatePath("/");
  }
  return result;
}
