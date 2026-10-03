/**
 * 가짜 구글 OAuth 서버 (테스트 전용) — 8790
 *   /auth  → redirect_uri 로 code + state 를 돌려준다
 *   /token → id_token(서명 검증을 하지 않는 JWT 모양)을 돌려준다
 * 앱은 GOOGLE_AUTH_ENDPOINT / GOOGLE_TOKEN_ENDPOINT 로 이 서버를 가리킨다.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_GOOGLE_PORT ?? 8790);
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "test-client-id.apps.googleusercontent.com";
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/auth") {
    const target = new URL(url.searchParams.get("redirect_uri"));
    target.searchParams.set("code", "test-auth-code");
    target.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { location: target.toString() });
    res.end();
    return;
  }

  if (url.pathname === "/token") {
    const now = Math.floor(Date.now() / 1000);
    const idToken = [
      b64({ alg: "RS256", typ: "JWT" }),
      b64({
        iss: "https://accounts.google.com",
        aud: CLIENT_ID,
        sub: "google-test-sub-1",
        email: "tester@gmail.com",
        email_verified: true,
        name: "구글 테스터",
        picture: "https://example.com/avatar.png",
        iat: now,
        exp: now + 3600,
      }),
      "signature",
    ].join(".");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ access_token: "test-access", id_token: idToken, token_type: "Bearer" }));
    return;
  }

  res.writeHead(404);
  res.end("not found");
}).listen(PORT, () => console.log(`mock google on ${PORT}`));
