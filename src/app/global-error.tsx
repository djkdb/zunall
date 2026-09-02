"use client";

/** 루트 레이아웃까지 실패했을 때의 마지막 방어선 (자체 html/body 필요) */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 24,
          background: "#fff",
          color: "#0F2338",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Cavero를 불러오지 못했습니다</h1>
          <p style={{ fontSize: 14, color: "#5b6b7c", lineHeight: 1.6 }}>
            잠시 후 다시 시도해주세요. 계속되면 <code>/api/health</code> 를 열어 상태를
            확인할 수 있습니다.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#8896a5", marginTop: 8 }}>오류 번호: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#2F6BFF",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
