import { Skeleton } from "@/components/ui/skeleton";

export default function ChecklistLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32 rounded" />
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}
