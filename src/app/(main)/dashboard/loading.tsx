import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero skeleton */}
      <Skeleton className="h-48 md:h-56 w-full rounded-2xl" />

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-3 md:gap-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 md:h-24 rounded-2xl" />
        ))}
      </div>

      {/* Trip list skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-20 rounded" />
        <div className="hidden md:block">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="md:hidden space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
