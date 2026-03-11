import { ScheduleSkeleton } from "@/components/layout/loading-skeleton";

export default function ScheduleLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <ScheduleSkeleton />
    </div>
  );
}
