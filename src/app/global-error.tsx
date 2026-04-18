"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[GlobalError]", error);

  return (
    <html lang="ko">
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>문제가 발생했습니다</h2>
          <p style={{ color: "#666", marginTop: "0.5rem" }}>
            {error.message || "알 수 없는 오류가 발생했습니다."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #ccc",
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
