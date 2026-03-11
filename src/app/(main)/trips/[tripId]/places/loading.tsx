import { PlaceCardSkeleton } from "@/components/layout/loading-skeleton";

export default function PlacesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded bg-muted animate-pulse" />
          <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <PlaceCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
