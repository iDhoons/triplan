import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Supabase 세션 갱신 처리
  const response = await updateSession(request);

  // nonce 생성 — CSP script-src에 주입
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // CSP 헤더 구성 (nonce 포함)
  const isDev = process.env.NODE_ENV === "development";
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} https://maps.googleapis.com https://vercel.live`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' https://lh3.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://places.googleapis.com https://generativelanguage.googleapis.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://vercel.live wss://vercel.live",
    "frame-src 'self' https://maps.googleapis.com https://vercel.live",
    "worker-src 'self' blob:",
  ].join("; ");

  // updateSession의 쿠키 설정을 유지하면서 nonce와 CSP 헤더 추가
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};
