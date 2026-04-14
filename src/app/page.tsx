import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Plane,
  Cloud,
  Globe,
  Users,
  MapPin,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-svh relative overflow-hidden bg-gradient-to-br from-auth-gradient-from to-auth-gradient-to">
      {/* Decorative */}
      <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-primary opacity-10 -rotate-12" />
      <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-chart-2 opacity-10" />
      <Cloud className="absolute top-1/4 right-1/4 hidden sm:block h-12 w-12 text-chart-2 opacity-8" />
      <Plane className="absolute bottom-1/3 left-1/4 hidden sm:block h-10 w-10 text-primary opacity-8 rotate-45" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center min-h-svh px-4 py-12 sm:py-20">
        {/* Hero */}
        <div className="text-center mb-12 sm:mb-16 animate-ios-spring">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 glass-light">
              <Globe className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-3">
            여행 플래너
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
            함께 계획하고, 비교하고,
            <br className="sm:hidden" /> AI로 똑똑하게 여행하세요
          </p>
        </div>

        {/* Features */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 sm:mb-16 animate-stagger">
          <div className="glass-card glass-shine rounded-2xl p-5 sm:p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 glass-light mb-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">
              실시간 협업
            </h3>
            <p className="text-muted-foreground text-xs">
              친구, 가족과 함께 여행을 계획하세요
            </p>
          </div>

          <div className="glass-card glass-shine rounded-2xl p-5 sm:p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-chart-2/10 glass-light mb-3">
              <MapPin className="h-5 w-5 text-chart-2" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">
              장소 비교 & 투표
            </h3>
            <p className="text-muted-foreground text-xs">
              가고 싶은 곳을 비교하고 투표로 결정하세요
            </p>
          </div>

          <div className="glass-card glass-shine rounded-2xl p-5 sm:p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-chart-3/10 glass-light mb-3">
              <Sparkles className="h-5 w-5 text-chart-3" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">
              AI 일정 추천
            </h3>
            <p className="text-muted-foreground text-xs">
              최적의 일정과 이동 경로를 제안받으세요
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          >
            시작하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          비밀번호 없이 이메일로 간편 로그인
        </p>
      </div>
    </div>
  );
}
