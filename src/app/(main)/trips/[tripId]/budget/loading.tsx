import { Card, CardContent } from "@/components/ui/card";

export default function BudgetLoading() {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded bg-muted animate-pulse" />
          <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-full rounded-full bg-muted animate-pulse" />
        </CardContent>
      </Card>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-8 w-2 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-5 w-16 rounded bg-muted animate-pulse shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
