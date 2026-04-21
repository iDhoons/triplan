import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  // production 환경에서만 Service Worker 활성화
  disable: process.env.NODE_ENV !== "production",
});

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // middleware에서 nonce 기반 CSP를 설정하므로 여기서는 'unsafe-inline' 제거
      // 이 헤더는 middleware 미적용 경로(정적 에셋 등)에만 폴백으로 적용됨
      `script-src 'self'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://maps.googleapis.com https://vercel.live`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      // img-src: 'self'=프록시된 Google Places 사진(/api/places/photo), 로컬 이미지
      //   lh3.googleusercontent.com = Google OAuth 사용자 아바타
      //   maps.googleapis.com       = travel-info-card staticmap (직접 <img> src)
      //   maps.gstatic.com          = Google Maps JS API 타일/아이콘 에셋
      //   places.googleapis.com 제거: 사진은 /api/places/photo로 프록시하므로 불필요
      // img-src: data:/blob: 제거 — 코드베이스에서 미사용, 불필요한 공격 표면 축소
      "img-src 'self' https://lh3.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://places.googleapis.com https://generativelanguage.googleapis.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://vercel.live wss://vercel.live",
      "frame-src 'self' https://maps.googleapis.com https://vercel.live",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Turbopack과 webpack 플러그인 충돌 억제
  // serwist는 webpack 기반이므로 turbopack 설정을 빈 객체로 명시
  turbopack: {},
  logging: false,
  reactCompiler: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
    viewTransition: true,
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
      {
        pathname: "/api/places/photo",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      // places.googleapis.com 제거: 사진은 /api/places/photo 프록시 경유
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
