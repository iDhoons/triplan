// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 개발 시 100%, 프로덕션에서 20% 샘플링 (무료 할당량 보호)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // PII(개인정보) 자동 전송 비활성화 (개인정보보호)
  sendDefaultPii: false,

  // 환경 구분 (Sentry 대시보드에서 dev/production 필터링)
  environment: process.env.NODE_ENV ?? "development",
});
