"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TripCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
        <div className="mt-4 pt-3 border-t border-border/50">
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PlaceCardSkeleton() {
  return (
    <Card variant="plain" className="relative h-44 sm:h-52 overflow-hidden border-0">
      <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
      <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
        <Skeleton className="h-4 w-3/4 bg-white/20" />
        <Skeleton className="h-3 w-1/2 bg-white/15" />
      </div>
    </Card>
  );
}

export function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
