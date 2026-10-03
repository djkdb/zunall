/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth"],
  async redirects() {
    return [
      // 브라우저·검색엔진·메신저 미리보기는 /favicon.ico 를 먼저 찾는다. 아이콘은 icon.svg 하나뿐이라 404 가 났다.
      { source: "/favicon.ico", destination: "/icon.svg", permanent: true },
    ];
  },
};

export default nextConfig;
