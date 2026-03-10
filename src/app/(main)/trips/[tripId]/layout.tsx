"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/database";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { OnlineMembers } from "@/components/realtime/online-members";
import { ActivityToast } from "@/components/realtime/activity-toast";
import { AiChatFab } from "@/components/ai/ai-chat-fab";

const tabs = [
  { href: "places", label: "장소" },
  { href: "schedule", label: "일정" },
  { href: "budget", label: "예산" },
  { href: "journal", label: "후기" },
  { href: "members", label: "멤버" },
];

export default function TripLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tripId = params.tripId as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTrip() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (data) setTrip(data as Trip);
    }
    fetchTrip();
  }, [tripId]);

  function openEdit() {
    if (!trip) return;
    setEditTitle(trip.title);
    setEditDestination(trip.destination);
    setEditStartDate(trip.start_date);
    setEditEndDate(trip.end_date);
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setSaving(true);

    const { error } = await supabase
      .from("trips")
      .update({
        title: editTitle.trim(),
        destination: editDestination.trim(),
        start_date: editStartDate,
        end_date: editEndDate,
      })
      .eq("id", trip.id);

    if (error) {
      toast.error("수정에 실패했습니다.");
      setSaving(false);
      return;
    }

    // 날짜가 변경되었으면 스케줄 동기화 (새 날짜 추가, 범위 밖 삭제)
    if (editStartDate !== trip.start_date || editEndDate !== trip.end_date) {
      const start = new Date(editStartDate);
      const end = new Date(editEndDate);
      const newDates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        newDates.push(d.toISOString().split("T")[0]);
      }

      // 기존 스케줄 조회
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, date")
        .eq("trip_id", trip.id);

      const existingDates = new Set((existing ?? []).map((s: { date: string }) => s.date));

      // 새 날짜 추가
      const toAdd = newDates.filter((d) => !existingDates.has(d));
      if (toAdd.length > 0) {
        await supabase.from("schedules").insert(
          toAdd.map((date) => ({ trip_id: trip.id, date }))
        );
      }

      // 범위 밖 날짜 삭제 (일정 아이템도 CASCADE로 삭제됨)
      const newDateSet = new Set(newDates);
      const toDelete = (existing ?? []).filter(
        (s: { id: string; date: string }) => !newDateSet.has(s.date)
      );
      if (toDelete.length > 0) {
        await supabase
          .from("schedules")
          .delete()
          .in("id", toDelete.map((s: { id: string }) => s.id));
      }
    }

    setTrip({
      ...trip,
      title: editTitle.trim(),
      destination: editDestination.trim(),
      start_date: editStartDate,
      end_date: editEndDate,
    });
    setEditOpen(false);
    setSaving(false);
    toast.success("여행 정보가 수정되었습니다.");
  }

  const activeTab = tabs.find((t) =>
    pathname.includes(`/trips/${tripId}/${t.href}`)
  );

  return (
    <RealtimeProvider tripId={tripId}>
      <ActivityToast />
      <div>
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              &larr;
            </Button>
            <div
              className="cursor-pointer group"
              onClick={openEdit}
              title="클릭하여 수정"
            >
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold">{trip?.title ?? "..."}</h1>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {trip && (
                <p className="text-xs text-muted-foreground">
                  {trip.destination} · {trip.start_date} ~ {trip.end_date}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OnlineMembers />
            <UserMenu />
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b mb-6 -mx-4 px-4">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={`/trips/${tripId}/${tab.href}`}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
                activeTab?.href === tab.href
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {children}
        <AiChatFab />
      </div>

      {/* 여행 정보 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>여행 정보 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>여행 이름</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>여행지</Label>
              <Input
                value={editDestination}
                onChange={(e) => setEditDestination(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>출발일</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>도착일</Label>
                <Input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </RealtimeProvider>
  );
}
