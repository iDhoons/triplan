"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plane, Cloud, Globe } from "lucide-react";
import { humanizeError } from "@/lib/error-messages";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(humanizeError(error.message));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-auth-gradient-from to-auth-gradient-to px-4 py-8">
      <Plane className="absolute top-12 left-8 sm:top-20 sm:left-20 h-16 w-16 sm:h-24 sm:w-24 text-primary opacity-10 -rotate-12" />
      <Cloud className="absolute bottom-12 right-8 sm:bottom-20 sm:right-20 h-16 w-16 sm:h-24 sm:w-24 text-chart-2 opacity-10" />
      <Cloud className="absolute top-1/4 right-1/4 hidden sm:block h-12 w-12 text-chart-2 opacity-8" />
      <Plane className="absolute bottom-1/3 left-1/4 hidden sm:block h-10 w-10 text-primary opacity-8 rotate-45" />

      <div className="relative w-full max-w-[440px] glass-card glass-shine rounded-3xl p-6 sm:p-10 animate-ios-spring">
        <div className="flex flex-col items-center mb-8 sm:mb-10">
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

        {error && (
          <p className="mb-4 text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          size="lg"
          variant="outline"
          className="w-full font-semibold cursor-pointer gap-3 rounded-xl py-6 border-glass-border bg-background/60 hover:bg-background/80 transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <GoogleIcon />
          {loading ? "로그인 중..." : "Google로 로그인"}
        </Button>
      </div>
    </div>
  );
}
