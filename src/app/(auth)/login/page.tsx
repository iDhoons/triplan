"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Cloud, Globe, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-svh flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#ffe5d9] to-[#dcf0fa] px-4 py-8">
      {/* Decorative Elements */}
      <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-[#f46a25] opacity-15 -rotate-12" />
      <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-sky-400 opacity-15" />
      <Cloud className="absolute top-1/4 right-1/4 hidden sm:block h-12 w-12 text-sky-300 opacity-10" />
      <Plane className="absolute bottom-1/3 left-1/4 hidden sm:block h-10 w-10 text-[#f46a25] opacity-10 rotate-45" />

      {/* Login Card */}
      <div className="relative w-full max-w-[440px] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-10 border border-white/50">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <Globe className="h-8 w-8 sm:h-9 sm:w-9 text-[#f46a25]" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              여행 플래너
            </h1>
          </div>
          <p className="text-slate-500 text-center text-sm sm:text-base">
            함께 계획하고, 비교하고, 똑똑하게 여행하세요
          </p>
        </div>

        {/* Google Login */}
        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full py-5 sm:py-6 text-sm sm:text-base font-semibold border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google로 계속하기
        </Button>

        {/* Divider */}
        <div className="relative flex items-center my-5 sm:my-6">
          <div className="flex-grow border-t border-slate-200" />
          <span className="flex-shrink-0 px-4 text-sm text-slate-400">또는</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-700">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 py-5 border-slate-200 focus-visible:ring-[#f46a25]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-700">비밀번호</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 py-5 border-slate-200 focus-visible:ring-[#f46a25]"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full py-5 sm:py-6 text-sm sm:text-base font-bold bg-[#f46a25] hover:bg-[#e05a18] text-white cursor-pointer"
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 sm:mt-8 text-center text-sm text-slate-500">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-bold text-[#f46a25] hover:text-[#e05a18]">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
