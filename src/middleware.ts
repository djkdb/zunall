import { NextResponse, type NextRequest } from "next/server";

/**
 * 로그인하지 않은 사람이 첫 주소로 들어오면 소개 화면을 보여준다.
 * 그동안은 곧바로 로그인 창이 떠서, 무슨 서비스인지 모른 채 가입부터 해야 했다.
 *
 * 쿠키가 있는지만 본다(유효성 검사는 각 화면에서 한다). 미들웨어는 모든 요청을
 * 거치므로 DB 를 건드리지 않는 것이 중요하다.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("cavero_session");
  if (!hasSession) {
    return NextResponse.rewrite(new URL("/welcome", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // 첫 주소에서만 동작한다
  matcher: "/",
};
