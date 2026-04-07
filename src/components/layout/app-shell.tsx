"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { OfflineBanner } from "./offline-banner";
import type { Profile } from "@/types/database";

export function AppShell({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    async function loadProfile() {
      // getSession()은 쿠키에서 로컬로 읽음 — 네트워크 호출 없음
      // (인증 검증은 middleware가 이미 수행함)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return; // middleware가 이미 리다이렉트 처리

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUser(profile as Profile);
      }
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, setUser]);

  // loading gate 제거 — children 즉시 렌더, trips fetch와 profile fetch 병렬 실행
  return (
    <div className="min-h-screen pb-[calc(50px+env(safe-area-inset-bottom,0px))] md:pb-0 md:pl-64">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm font-medium"
      >
        본문으로 이동
      </a>
      <OfflineBanner />
      <Sidebar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <BottomNav />
    </div>
  );
}
