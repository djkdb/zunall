/**
 * 보안 헤더. 외부 스크립트·폰트를 쓰지 않으므로 출처를 자기 자신으로 좁힌다.
 * - 'unsafe-inline' 스크립트: Next 의 인라인 부트스트랩과 테마 스크립트 때문 (nonce 를 쓰면 모든 화면이 캐시 불가가 된다)
 * - 'unsafe-eval' 은 개발 서버에서만 (React 새로고침이 eval 을 쓴다)
 * - 이미지는 https 전체 허용: 구글 프로필 사진, 공고 썸네일
 * - 포트폴리오 공유 화면(/p/)만 다른 사이트(노션 등)에 끼워 넣을 수 있다
 */
const isDev = process.env.NODE_ENV !== "production";

function csp(frameAncestors) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-src 'self'",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");
}

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 마이크는 모의 면접의 "말로 답하기"에만 쓴다
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...common, { key: "Content-Security-Policy", value: csp("'self'") }] },
      // 뒤에 오는 규칙이 같은 헤더를 덮어쓴다
      { source: "/p/:path*", headers: [{ key: "Content-Security-Policy", value: csp("*") }] },
    ];
  },
  async redirects() {
    return [
      // 브라우저·검색엔진·메신저 미리보기는 /favicon.ico 를 먼저 찾는다. 아이콘은 icon.svg 하나뿐이라 404 가 났다.
      { source: "/favicon.ico", destination: "/icon.svg", permanent: true },
    ];
  },
};

export default nextConfig;
