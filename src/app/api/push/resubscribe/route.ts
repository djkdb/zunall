import { NextResponse } from "next/server";
import { savePushSubscription } from "@/actions/push";

export const dynamic = "force-dynamic";

/** 브라우저가 구독을 갱신했을 때 서비스 워커가 호출한다 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const result = await savePushSubscription({
      endpoint: body.endpoint ?? "",
      p256dh: body.keys?.p256dh ?? "",
      auth: body.keys?.auth ?? "",
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
