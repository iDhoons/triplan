"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Cloud, Globe, Mail, Send } from "lucide-react";
import { humanizeError } from "@/lib/error-messages";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const devEmail = process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL;
  const devPassword = process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD;

  async function handleDevLogin() {
    if (!devEmail || !devPassword) return;
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    });

    if (error) {
      setError(humanizeError(error.message));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(humanizeError(error.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  // 성공 화면: 이메일 확인 안내
  if (success) {
    return (
      <div className="min-h-svh flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-auth-gradient-from to-auth-gradient-to px-4 py-8">
        <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-primary opacity-10 -rotate-12" />
        <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-chart-2 opacity-10" />

        <div className="relative w-full max-w-[440px] glass-card glass-shine rounded-3xl p-6 sm:p-10 animate-ios-spring">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 glass-light">
              <Send className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">이메일을 확인해주세요</h2>
            <p className="text-muted-foreground text-sm">
              <span className="font-medium text-foreground">{email}</span>
              <br />
              로 로그인 링크를 보냈습니다.
            </p>
            <p className="text-xs text-muted-foreground">
              메일함에서 링크를 클릭하면 로그인됩니다.
              <br />
              스팸함도 확인해주세요.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
              className="cursor-pointer rounded-xl mt-4"
            >
              다른 이메일로 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-auth-gradient-from to-auth-gradient-to px-4 py-8">
      {/* Decorative Elements */}
      <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-primary opacity-10 -rotate-12" />
      <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-chart-2 opacity-10" />
      <Cloud className="absolute top-1/4 right-1/4 hidden sm:block h-12 w-12 text-chart-2 opacity-8" />
      <Plane className="absolute bottom-1/3 left-1/4 hidden sm:block h-10 w-10 text-primary opacity-8 rotate-45" />

      {/* Login Card */}
      <div className="relative w-full max-w-[440px] glass-card glass-shine rounded-3xl p-6 sm:p-10 animate-ios-spring">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 glass-light">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              여행 플래너
            </h1>
          </div>
          <p className="text-muted-foreground text-center text-sm sm:text-base">
            함께 계획하고, 비교하고, 똑똑하게 여행하세요
          </p>
        </div>

        {/* Magic Link Form */}
        <form onSubmit={handleMagicLink} className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground/80">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 py-5 rounded-xl bg-glass-light border-glass-border"
                required
                autoFocus
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full font-bold cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? (
              "링크 보내는 중..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                로그인 링크 보내기
              </>
            )}
          </Button>
        </form>

        {/* Info */}
        <p className="mt-6 sm:mt-8 text-center text-xs text-muted-foreground">
          비밀번호 없이 이메일만으로 로그인합니다.
          <br />
          처음 사용하시면 자동으로 가입됩니다.
        </p>

        {process.env.NODE_ENV === "development" && devEmail && (
          <div className="mt-4 pt-4 border-t border-glass-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDevLogin}
              disabled={loading}
              className="w-full cursor-pointer rounded-xl text-xs"
            >
              Dev 빠른 로그인 ({devEmail})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
