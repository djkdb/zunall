import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, documents } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { readFileBuffer } from "@/lib/storage";

/** 업로드 파일 다운로드 (본인 파일만) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const doc = (await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
    .limit(1))[0];
  if (!doc) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const buffer = await readFileBuffer(doc.storagePath);
  if (!buffer) {
    return NextResponse.json({ error: "파일이 저장소에 없습니다." }, { status: 404 });
  }

  const encodedName = encodeURIComponent(doc.originalName).replace(/'/g, "%27");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=0",
    },
  });
}
