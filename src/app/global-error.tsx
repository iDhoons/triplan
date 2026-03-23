"use client";

import NextError from "next/error";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  // 서버 측 Sentry(instrumentation.ts)가 이 에러를 자동 캡처
  console.error("[GlobalError]", error);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
