"use client";

import { Button } from "@/components/ui/button";
import { SORT_OPTIONS, type SortMode } from "./constants";

interface SortToggleProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div className="flex gap-1">
      {SORT_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? "default" : "outline"}
          size="sm"
          className="text-xs h-7 px-2.5"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
