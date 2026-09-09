import { NextResponse } from "next/server";
import { createDemoUser } from "@/services/demo/seed";
import { issueSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * 둘러보기.
 * 가입 없이 예시 자료가 채워진 앱을 그대로 볼 수 있게, 임시 계정을 만들어 로그인시킨다.
 * 계정이 분리돼 있어 남의 자료를 보거나 망칠 일이 없고, 오래된 계정은 크론이 지운다.
 */
export async function GET(request: Request) {
  if (process.env.DEMO_MODE === "off") {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  try {
    const userId = await createDemoUser();
    const cookie = await issueSession(userId);

    const response = NextResponse.redirect(new URL("/?demo=1", request.url));
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    // 삼키면 "둘러보기가 안 된다"는 것만 알고 이유를 영영 알 수 없다.
    console.error("demo seed failed:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/welcome?error=demo", request.url));
  }
}
