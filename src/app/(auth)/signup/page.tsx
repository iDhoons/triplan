"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Cloud, Globe, User, Mail, Lock } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-svh flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-auth-gradient-from to-auth-gradient-to px-4 py-8">
        <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-primary opacity-15 -rotate-12" />
        <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-chart-2 opacity-15" />
        <div className="relative w-full max-w-[440px] bg-card/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-10 border border-card/50">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">이메일을 확인해주세요</h2>
            <p className="text-muted-foreground text-sm">
              {email}로 인증 메일을 보냈습니다.
              <br />
              메일의 링크를 클릭하면 가입이 완료됩니다.
            </p>
            <Button variant="outline" onClick={() => router.push("/login")} className="cursor-pointer">
              로그인으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-auth-gradient-from to-auth-gradient-to px-4 py-8">
      <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-primary opacity-15 -rotate-12" />
      <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-chart-2 opacity-15" />
      <Cloud className="absolute top-1/4 right-1/4 hidden sm:block h-12 w-12 text-chart-2 opacity-10" />
      <Plane className="absolute bottom-1/3 left-1/4 hidden sm:block h-10 w-10 text-primary opacity-10 rotate-45" />

      <div className="relative w-full max-w-[440px] bg-card/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-10 border border-card/50">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <Globe className="h-8 w-8 sm:h-9 sm:w-9 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              회원가입
            </h1>
          </div>
          <p className="text-muted-foreground text-center text-sm sm:text-base">
            여행 플래너에 가입하세요
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-foreground/80">이름</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 py-5"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground/80">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 py-5"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground/80">비밀번호</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type="password"
                placeholder="6자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 py-5"
                minLength={6}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full py-5 sm:py-6 text-sm sm:text-base font-bold cursor-pointer" disabled={loading}>
            {loading ? "가입 중..." : "가입하기"}
          </Button>
        </form>

        <p className="mt-6 sm:mt-8 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-bold text-primary hover:text-primary/80">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
