import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // production 환경에서만 Service Worker 활성화
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Turbopack과 webpack 플러그인 충돌 억제
  // serwist는 webpack 기반이므로 turbopack 설정을 빈 객체로 명시
  turbopack: {},
};

export default withSerwist(nextConfig);
