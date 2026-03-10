"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Trip } from "@/types/database";

interface TripEditDialogProps {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Trip) => void;
}

export function TripEditDialog({
  trip,
  open,
  onOpenChange,
  onSaved,
}: TripEditDialogProps) {
  const [editTitle, setEditTitle] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  function handleOpen(isOpen: boolean) {
    if (isOpen && trip) {
      setEditTitle(trip.title);
      setEditDestination(trip.destination);
      setEditStartDate(trip.start_date);
      setEditEndDate(trip.end_date);
    }
    onOpenChange(isOpen);
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

    if (editStartDate !== trip.start_date || editEndDate !== trip.end_date) {
      const start = new Date(editStartDate);
      const end = new Date(editEndDate);
      const newDates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        newDates.push(d.toISOString().split("T")[0]);
      }

      const { data: existing } = await supabase
        .from("schedules")
        .select("id, date")
        .eq("trip_id", trip.id);

      const existingDates = new Set(
        (existing ?? []).map((s: { date: string }) => s.date)
      );

      const toAdd = newDates.filter((d) => !existingDates.has(d));
      if (toAdd.length > 0) {
        await supabase
          .from("schedules")
          .insert(toAdd.map((date) => ({ trip_id: trip.id, date })));
      }

      const newDateSet = new Set(newDates);
      const toDelete = (existing ?? []).filter(
        (s: { id: string; date: string }) => !newDateSet.has(s.date)
      );
      if (toDelete.length > 0) {
        await supabase
          .from("schedules")
          .delete()
          .in(
            "id",
            toDelete.map((s: { id: string }) => s.id)
          );
      }
    }

    const updated: Trip = {
      ...trip,
      title: editTitle.trim(),
      destination: editDestination.trim(),
      start_date: editStartDate,
      end_date: editEndDate,
    };
    onSaved(updated);
    onOpenChange(false);
    setSaving(false);
    toast.success("여행 정보가 수정되었습니다.");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
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
              onClick={() => onOpenChange(false)}
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
  );
}
