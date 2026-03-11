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
    <Card>
      <Skeleton className="h-40 w-full rounded-b-none" />
      <CardContent className="p-4 space-y-2.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </CardContent>
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
