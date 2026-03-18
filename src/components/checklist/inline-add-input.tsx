"use client";

import { useState, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineAddInputProps {
  placeholder?: string;
  onAdd: (title: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
}

export function InlineAddInput({
  placeholder = "항목 이름을 입력하세요...",
  onAdd,
  onCancel,
  autoFocus = true,
  className,
}: InlineAddInputProps) {
  const [title, setTitle] = useState("");
  const isComposingRef = useRef(false);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  }, [title, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isComposingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setTitle("");
      onCancel?.();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-3 rounded-lg border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors",
        className
      )}
    >
      <Plus className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={200}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
      />
    </div>
  );
}
