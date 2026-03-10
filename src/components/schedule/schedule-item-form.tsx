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
import type { ScheduleItem, Place } from "@/types/database";

const TRANSPORT_OPTIONS = [
  { value: "도보", label: "도보" },
  { value: "버스", label: "버스" },
  { value: "지하철", label: "지하철" },
  { value: "택시", label: "택시" },
  { value: "렌터카", label: "렌터카" },
  { value: "기차", label: "기차" },
  { value: "비행기", label: "비행기" },
  { value: "배", label: "배" },
];

interface ScheduleItemFormData {
  title: string;
  start_time: string;
  end_time: string;
  memo: string;
  transport_to_next: string;
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
  start_time: "",
  end_time: "",
  memo: "",
  transport_to_next: "",
  place_id: "",
};

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
        start_time: editingItem.start_time?.slice(0, 5) ?? "",
        end_time: editingItem.end_time?.slice(0, 5) ?? "",
        memo: editingItem.memo ?? "",
        transport_to_next: editingItem.transport_to_next ?? "",
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

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">시작 시간</Label>
              <Input
                id="start_time"
                type="time"
                value={form.start_time}
                onChange={(e) => set("start_time")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">종료 시간</Label>
              <Input
                id="end_time"
                type="time"
                value={form.end_time}
                onChange={(e) => set("end_time")(e.target.value)}
              />
            </div>
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

          {/* Transport to next */}
          <div className="space-y-1.5">
            <Label>다음 장소 이동 수단</Label>
            <Select
              value={form.transport_to_next || "none"}
              onValueChange={(v) =>
                set("transport_to_next")(v == null || v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="이동 수단 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {TRANSPORT_OPTIONS.map((opt) => (
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
