"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUser(profile as Profile);
      }
      setLoading(false);
    }

    getProfile();

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0 md:pl-64">
      <OfflineBanner />
      <Sidebar />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <BottomNav />
    </div>
  );
}
