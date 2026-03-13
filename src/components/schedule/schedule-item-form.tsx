"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleItem, Place, TravelMode } from "@/types/database";

const TRAVEL_MODE_OPTIONS: { value: TravelMode; label: string }[] = [
  { value: "walking", label: "도보" },
  { value: "transit", label: "대중교통" },
  { value: "driving", label: "자동차" },
];

export interface ScheduleItemFormData {
  title: string;
  arrival_by: string;
  memo: string;
  travel_mode: string;
  place_id: string;
}

interface ScheduleItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: ScheduleItem | null;
  places: Place[];
  onSubmit: (data: ScheduleItemFormData) => Promise<void>;
}

const EMPTY_FORM: ScheduleItemFormData = {
  title: "",
  arrival_by: "",
  memo: "",
  travel_mode: "",
  place_id: "",
};

/** TIMESTAMPTZ → datetime-local 값 변환 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function ScheduleItemForm({
  open,
  onOpenChange,
  editingItem,
  places,
  onSubmit,
}: ScheduleItemFormProps) {
  const [form, setForm] = useState<ScheduleItemFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setForm({
        title: editingItem.title,
        arrival_by: toDatetimeLocal(editingItem.arrival_by),
        memo: editingItem.memo ?? "",
        travel_mode: editingItem.travel_mode ?? "",
        place_id: editingItem.place_id ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editingItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const set = (key: keyof ScheduleItemFormData) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "일정 수정" : "일정 추가"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              required
            />
          </div>

          {/* Arrival by (datetime-local) */}
          <div className="space-y-1.5">
            <Label htmlFor="arrival_by">희망 도착 시간</Label>
            <Input
              id="arrival_by"
              type="datetime-local"
              value={form.arrival_by}
              onChange={(e) => set("arrival_by")(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              설정하면 이동시간을 역산하여 출발 알림을 받을 수 있습니다.
            </p>
          </div>

          {/* Place */}
          <div className="space-y-1.5">
            <Label>연결 장소 (선택)</Label>
            <Select
              value={form.place_id || "none"}
              onValueChange={(v) => set("place_id")(v == null || v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="장소를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {places.map((place) => (
                  <SelectItem key={place.id} value={place.id}>
                    {place.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Memo */}
          <div className="space-y-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea
              id="memo"
              value={form.memo}
              onChange={(e) => set("memo")(e.target.value)}
              placeholder="메모를 입력하세요"
              rows={3}
            />
          </div>

          {/* Travel mode */}
          <div className="space-y-1.5">
            <Label>이동 수단</Label>
            <Select
              value={form.travel_mode || "none"}
              onValueChange={(v) =>
                set("travel_mode")(v == null || v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="이동 수단 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {TRAVEL_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button type="submit" disabled={loading || !form.title.trim()}>
              {loading ? "저장 중..." : editingItem ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
