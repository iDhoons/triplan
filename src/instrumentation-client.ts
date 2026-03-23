// Sentry 클라이언트 SDK 비활성화 — 400KB 번들 절감
// 서버 측 Sentry(instrumentation.ts, sentry.server.config.ts)가 API/SSR 에러를 캡처
// 클라이언트(브라우저) JS 에러는 모니터링되지 않음
// 필요 시 /api/report-error 엔드포인트를 만들어 경량 에러 리포팅 구현 가능
