"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7일

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "installed" | "unsupported";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unsupported";

  // 이미 standalone(설치됨)이면 표시하지 않음
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone)
  ) {
    return "installed";
  }

  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";

  return "unsupported";
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (Date.now() - ts > DISMISS_DURATION_MS) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function InstallBanner() {
  const [platform] = useState<Platform>(() => {
    if (typeof window === "undefined") return "unsupported";
    return detectPlatform();
  });
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // beforeinstallprompt 이벤트 캡처 (Android/Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 배너 표시 여부
  useEffect(() => {
    if (platform === "installed" || platform === "unsupported") return;
    if (isDismissed()) return;

    // 약간의 딜레이 후 표시 (UX)
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [platform]);

  const handleInstallAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed();
  }, []);

  if (!visible) return null;

  // Android: 네이티브 설치 프롬프트
  if (platform === "android" && deferredPrompt) {
    return (
      <div className="fixed inset-x-0 bottom-16 z-50 mx-4 animate-in slide-in-from-bottom-4 md:bottom-4 md:left-auto md:right-4 md:mx-0 md:max-w-sm">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">앱 설치하기</p>
            <p className="text-xs text-muted-foreground">
              설치하면 다른 앱에서 바로 공유할 수 있어요
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" onClick={handleInstallAndroid}>
              설치
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleDismiss}
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // iOS: 수동 안내
  if (platform === "ios") {
    return (
      <>
        <div className="fixed inset-x-0 bottom-16 z-50 mx-4 animate-in slide-in-from-bottom-4 md:bottom-4 md:left-auto md:right-4 md:mx-0 md:max-w-sm">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 shadow-lg">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">홈 화면에 추가</p>
              <p className="text-xs text-muted-foreground">
                추가하면 다른 앱에서 바로 공유할 수 있어요
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" onClick={() => setShowIosGuide(true)}>
                방법 보기
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleDismiss}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* iOS 설치 가이드 오버레이 */}
        {showIosGuide && (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4"
            onClick={() => setShowIosGuide(false)}
          >
            <div
              className="w-full max-w-sm animate-in slide-in-from-bottom-8 rounded-2xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-base font-semibold">홈 화면에 추가하는 법</p>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setShowIosGuide(false)}
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      하단의 공유 버튼 누르기
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Share className="h-3.5 w-3.5" />
                      <span>Safari 하단 바의 공유 아이콘</span>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      &ldquo;홈 화면에 추가&rdquo; 선택
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      아래로 스크롤하면 보일 수 있어요
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      &ldquo;추가&rdquo; 탭하기
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      완료! 이제 공유 메뉴에 여행 플래너가 나타나요
                    </p>
                  </div>
                </li>
              </ol>

              <Button
                className="mt-5 w-full"
                onClick={() => {
                  setShowIosGuide(false);
                  handleDismiss();
                }}
              >
                확인
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Android에서 beforeinstallprompt 아직 안 온 경우에도 안내
  if (platform === "android") {
    return (
      <div className="fixed inset-x-0 bottom-16 z-50 mx-4 animate-in slide-in-from-bottom-4 md:bottom-4 md:left-auto md:right-4 md:mx-0 md:max-w-sm">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">앱 설치하기</p>
            <p className="text-xs text-muted-foreground">
              Chrome 메뉴(&#8942;) &rarr; &ldquo;앱 설치&rdquo;를 눌러주세요
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleDismiss}
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
