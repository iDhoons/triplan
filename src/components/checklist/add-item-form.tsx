"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Tag } from "lucide-react";
import { CHECKLIST_CATEGORIES, CATEGORY_MAP } from "./constants";
import { useAutoClassify } from "@/hooks/use-auto-classify";
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
  const [manualOverride, setManualOverride] = useState(!!defaultCategory);

  const {
    classifiedCategory,
    source,
    isClassifying,
    classify,
    reset: resetClassify,
  } = useAutoClassify();

  const reset = () => {
    setTitle("");
    setCategory(defaultCategory ?? "shared");
    setPriority("medium");
    setAssignedTo("none");
    setMemo("");
    setManualOverride(!!defaultCategory);
    resetClassify();
  };

  // 분류 결과 → 카테고리 반영
  useEffect(() => {
    if (classifiedCategory && !manualOverride) {
      setCategory(classifiedCategory);
    }
  }, [classifiedCategory, manualOverride]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!manualOverride) {
      classify(newTitle);
    }
  };

  const handleCategoryChange = (v: string | null) => {
    if (!v) return;
    setCategory(v as ChecklistCategory);
    setManualOverride(true);
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

  // Sheet 닫힐 때 초기화
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      reset();
      onClose();
    }
  };

  const classifyLabel =
    source === "keyword" || source === "ai"
      ? CATEGORY_MAP[classifiedCategory!]?.label
      : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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
              onChange={handleTitleChange}
              maxLength={200}
              autoFocus
            />
            {/* 자동 분류 피드백 */}
            {!manualOverride && title.trim() && (
              <div className="flex items-center gap-1.5 min-h-[20px]">
                {isClassifying ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    분류 중...
                  </span>
                ) : classifyLabel ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 gap-0.5"
                  >
                    {source === "ai" ? (
                      <Sparkles className="h-2.5 w-2.5" />
                    ) : (
                      <Tag className="h-2.5 w-2.5" />
                    )}
                    {classifyLabel}
                  </Badge>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리 *</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
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
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as ChecklistPriority)}
              >
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
            <Select
              value={assignedTo}
              onValueChange={(v) => setAssignedTo(v ?? "none")}
            >
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
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                reset();
                onClose();
              }}
            >
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
