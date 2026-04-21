import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

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
    // Google Places photo proxy — CacheFirst
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/places/photo"),
      handler: new CacheFirst({
        cacheName: "place-photos",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
      method: "GET",
    },
    // Weather API — CacheFirst
    {
      matcher: ({ url }) => url.pathname === "/api/weather",
      handler: new CacheFirst({
        cacheName: "weather-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 3 * 60 * 60, // 3 hours
          }),
        ],
      }),
      method: "GET",
    },
    // Directions API — CacheFirst
    {
      matcher: ({ url }) => url.pathname === "/api/directions",
      handler: new CacheFirst({
        cacheName: "directions-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          }),
        ],
      }),
      method: "GET",
    },
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
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)(\?.*)?$/,
      handler: new CacheFirst({
        cacheName: "image-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30일
          }),
        ],
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

// ─── Push Notification ───────────────────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: "triplan", body: event.data.text() };
  }

  const { title, body, url = "/", icon = "/icons/icon-192x192.png" } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icons/icon-72x72.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const url: string = (event.notification.data as { url?: string })?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) => c.url === url && "focus" in c);
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
