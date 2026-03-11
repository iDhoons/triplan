import { TripCardSkeleton } from "@/components/layout/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded bg-muted animate-pulse" />
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
