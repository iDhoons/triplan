"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useChecklistLogs } from "@/hooks/use-checklist";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, X } from "lucide-react";

interface ItemHistoryProps {
  itemId: string | null;
  itemTitle: string;
  onClose: () => void;
}

export function ItemHistory({ itemId, itemTitle, onClose }: ItemHistoryProps) {
  const { data: logs, isLoading } = useChecklistLogs(itemId);

  return (
    <Sheet open={!!itemId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm truncate">
            히스토리: {itemTitle}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!isLoading && logs && logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              아직 기록이 없어요
            </p>
          )}

          {logs?.map((log) => (
            <div key={log.id} className="flex items-center gap-3">
              <Avatar className="h-6 w-6">
                <AvatarImage src={log.performer?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {log.performer?.display_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">
                    {log.performer?.display_name}
                  </span>
                  {" "}
                  {log.action === "checked" ? (
                    <span className="inline-flex items-center gap-0.5 text-green-600">
                      <Check className="h-3 w-3" /> 완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-orange-500">
                      <X className="h-3 w-3" /> 해제
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(log.performed_at), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
