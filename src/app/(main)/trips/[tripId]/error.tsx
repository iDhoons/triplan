"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TripError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-8 gap-4">
          <h2 className="text-xl font-bold text-muted-foreground">
            문제가 발생했습니다
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            여행 정보를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.
          </p>
          <Button onClick={reset}>다시 시도</Button>
        </CardContent>
      </Card>
    </div>
  );
}
