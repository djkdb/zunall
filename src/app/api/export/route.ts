import { requireUser } from "@/lib/auth/session";
import { exportUserData } from "@/services/backup/export";

export const dynamic = "force-dynamic";

/** 내 데이터 전체를 JSON 파일로 내려받는다 */
export async function GET() {
  const user = await requireUser();
  const backup = await exportUserData(user.id);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="cavero-backup-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
