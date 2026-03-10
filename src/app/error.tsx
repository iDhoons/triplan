"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-muted-foreground">오류 발생</h1>
      <p className="mt-4 text-muted-foreground">
        문제가 발생했습니다. 다시 시도해주세요.
      </p>
      <Button onClick={reset} className="mt-6">
        다시 시도
      </Button>
    </div>
  );
}
