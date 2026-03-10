import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "serwist";

// serwist 전역 설정 타입 확장
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API 응답: NetworkFirst — 오프라인 시 캐시 fallback
    {
      matcher: /^https?:\/\/.*\/api\//,
      handler: new NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 10,
        plugins: [],
      }),
    },
    // Supabase API: NetworkFirst
    {
      matcher: /^https:\/\/.*\.supabase\.co\//,
      handler: new NetworkFirst({
        cacheName: "supabase-cache",
        networkTimeoutSeconds: 10,
        plugins: [],
      }),
    },
    // 이미지: CacheFirst — 변경이 드물어 캐시 우선
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: new CacheFirst({
        cacheName: "image-cache",
        plugins: [],
      }),
    },
    // 정적 자산 (폰트, CSS): StaleWhileRevalidate
    {
      matcher: /\.(?:woff|woff2|ttf|otf|eot|css)$/,
      handler: new StaleWhileRevalidate({
        cacheName: "static-asset-cache",
        plugins: [],
      }),
    },
    // 페이지 내비게이션: NetworkFirst
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "page-cache",
        networkTimeoutSeconds: 3,
        plugins: [],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
