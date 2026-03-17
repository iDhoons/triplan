"use client";

import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CHECKLIST_CATEGORIES } from "./constants";
import type {
  ChecklistCategory,
  ChecklistPriority,
  TripMember,
} from "@/types/database";

interface AddItemFormProps {
  open: boolean;
  members: TripMember[];
  defaultCategory?: ChecklistCategory;
  onSubmit: (data: {
    category: ChecklistCategory;
    title: string;
    priority: ChecklistPriority;
    assigned_to: string | null;
    memo: string | null;
  }) => void;
  onClose: () => void;
}

export function AddItemForm({
  open,
  members,
  defaultCategory,
  onSubmit,
  onClose,
}: AddItemFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>(
    defaultCategory ?? "shared"
  );
  const [priority, setPriority] = useState<ChecklistPriority>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [memo, setMemo] = useState("");

  const reset = () => {
    setTitle("");
    setCategory(defaultCategory ?? "shared");
    setPriority("medium");
    setAssignedTo("none");
    setMemo("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      category,
      title: title.trim(),
      priority,
      assigned_to: assignedTo === "none" ? null : assignedTo,
      memo: memo.trim() || null,
    });
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>항목 추가</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">이름 *</Label>
            <Input
              id="title"
              placeholder="예: 여권, 충전기..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리 *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ChecklistCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>우선순위</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ChecklistPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>담당자</Label>
            <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? "none")}>
              <SelectTrigger>
                <SelectValue placeholder="미배정" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미배정</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[8px]">
                          {m.profile?.display_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      {m.profile?.display_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea
              id="memo"
              placeholder="참고 사항..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={!title.trim()}>
              추가
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
