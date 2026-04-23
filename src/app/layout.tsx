import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "여행 플래너",
    template: "%s | 여행 플래너",
  },
  description: "함께 계획하고, 비교하고, AI로 똑똑하게 여행하세요",
  openGraph: {
    title: "여행 플래너",
    description: "함께 계획하고, 비교하고, AI로 똑똑하게 여행하세요",
    siteName: "여행 플래너",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "여행 플래너",
    description: "함께 계획하고, 비교하고, AI로 똑똑하게 여행하세요",
    images: ["/icons/icon-512x512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "여행 플래너",
  },
  formatDetection: {
    telephone: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        {/* Inline splash — JS 로드 전 즉시 표시, hydration 후 fade-out */}
        <div
          id="splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            background: "oklch(0.97 0 0)",
            transition: "opacity 0.4s ease-out",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "3px solid oklch(0.636 0.178 47 / 20%)",
              borderTopColor: "oklch(0.636 0.178 47)",
              animation: "splash-spin 0.8s linear infinite",
            }}
          />
          <p
            style={{
              fontSize: "0.875rem",
              color: "oklch(0.45 0 0)",
              letterSpacing: "-0.01em",
            }}
          >
            여행 플래너
          </p>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
