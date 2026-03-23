import { Skeleton } from "@/components/ui/skeleton";

export default function PlaceDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
