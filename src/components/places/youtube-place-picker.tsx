"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  YoutubeIcon,
  SearchIcon,
  CheckIcon,
  AlertTriangleIcon,
  LoaderIcon,
  ChevronDownIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLACE_CATEGORY_LABEL } from "@/config/categories";
import type { PlaceCategory } from "@/types/database";
import type { ExtractedPlace } from "@/types/youtube";

// ── 타입 ──

interface AnalysisResult {
  videoTitle: string;
  source: "transcript" | "description";
  language: string;
  isShorts: boolean;
  places: ExtractedPlace[];
}

interface YouTubePlacePickerProps {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── 상수 ──

type AnalysisStep = "idle" | "extracting" | "analyzing" | "done" | "error";

const INITIAL_SHOW_COUNT = 15;

// ── 컴포넌트 ──

export function YouTubePlacePicker({
  tripId,
  open,
  onOpenChange,
}: YouTubePlacePickerProps) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  // 상태
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<AnalysisStep>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkedNames, setCheckedNames] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<PlaceCategory | "all">("all");
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // ── 파생 데이터 (useMemo) ──

  const filteredPlaces = useMemo(() => {
    if (!result) return [];
    if (filterCategory === "all") return result.places;
    return result.places.filter((p) => p.category === filterCategory);
  }, [result, filterCategory]);

  const categoryCounts = useMemo(() => {
    if (!result) return { all: 0, accommodation: 0, attraction: 0, restaurant: 0, other: 0 };
    const counts: Record<string, number> = { all: result.places.length };
    for (const p of result.places) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts as Record<PlaceCategory | "all", number>;
  }, [result]);

  const allFilteredChecked = useMemo(
    () => filteredPlaces.length > 0 && filteredPlaces.every((p) => checkedNames.has(p.name)),
    [filteredPlaces, checkedNames]
  );

  const displayPlaces = showAll
    ? filteredPlaces
    : filteredPlaces.slice(0, INITIAL_SHOW_COUNT);
  const hasMore = filteredPlaces.length > INITIAL_SHOW_COUNT && !showAll;
  const selectedCount = checkedNames.size;

  // ── 분석 시작 ──

  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStep("extracting");
    setResult(null);
    setErrorMessage("");
    setCheckedNames(new Set());
    setFilterCategory("all");
    setExpandedNames(new Set());
    setShowAll(false);

    try {
      const stepTimer = setTimeout(() => setStep("analyzing"), 1500);

      const res = await fetch("/api/youtube/extract-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
      });

      clearTimeout(stepTimer);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        setErrorMessage(data.error || "분석 중 오류가 발생했습니다.");
        setStep("error");
        return;
      }

      const data: AnalysisResult = await res.json();
      setResult(data);

      if (data.places.length === 0) {
        setErrorMessage(
          "영상에서 구체적인 장소를 찾지 못했습니다. 여행/맛집 관련 영상에서 가장 잘 작동합니다."
        );
        setStep("error");
        return;
      }

      const defaultChecked = new Set(
        data.places
          .filter((p) => p.confidence !== "low")
          .map((p) => p.name)
      );
      setCheckedNames(defaultChecked);
      setStep("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStep("idle");
        return;
      }
      setErrorMessage("분석 중 오류가 발생했습니다. 다시 시도해주세요.");
      setStep("error");
    }
  }, [url]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setStep("idle");
  }, []);

  // ── 체크박스 ──

  const toggleCheck = useCallback((name: string) => {
    setCheckedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCheckedNames((prev) => {
      const next = new Set(prev);
      const shouldUncheck = filteredPlaces.every((p) => prev.has(p.name));
      if (shouldUncheck) {
        filteredPlaces.forEach((p) => next.delete(p.name));
      } else {
        filteredPlaces.forEach((p) => next.add(p.name));
      }
      return next;
    });
  }, [filteredPlaces]);

  const toggleExpand = useCallback((name: string) => {
    setExpandedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── 선택한 장소 추가 ──

  const handleAddPlaces = useCallback(async () => {
    if (!result || checkedNames.size === 0) return;

    const selectedPlaces = result.places.filter((p) => checkedNames.has(p.name));
    setIsAdding(true);

    try {
      const res = await fetch("/api/youtube/add-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          places: selectedPlaces.map((p) => ({
            name: p.name,
            category: p.category,
            context: p.context,
            confidence: p.confidence,
            timestamp: p.timestamp,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "오류" }));
        toast.error(data.error || "장소 추가에 실패했습니다");
        return;
      }

      const data = await res.json();
      const addedCount = data.added?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;

      if (skippedCount > 0) {
        toast.success(`${addedCount}개 추가, ${skippedCount}개는 이미 있는 장소입니다`);
      } else {
        toast.success(`${addedCount}개 장소가 추가되었습니다`);
      }

      queryClient.invalidateQueries({ queryKey: ["places", tripId] });
      onOpenChange(false);

      setUrl("");
      setStep("idle");
      setResult(null);
    } catch {
      toast.error("장소 추가 중 오류가 발생했습니다");
    } finally {
      setIsAdding(false);
    }
  }, [result, checkedNames, tripId, queryClient, onOpenChange]);

  // ── 렌더 ──

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[100dvh] flex flex-col p-0 sm:h-auto sm:max-h-[90dvh] sm:rounded-t-xl"
      >
        {/* 헤더 */}
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <YoutubeIcon className="size-5 text-red-500" />
            YouTube에서 장소 가져오기
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </SheetHeader>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* URL 입력 */}
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="YouTube URL 붙여넣기"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              disabled={step === "extracting" || step === "analyzing"}
            />
            {step === "extracting" || step === "analyzing" ? (
              <Button variant="outline" onClick={handleCancel}>
                취소
              </Button>
            ) : (
              <Button onClick={handleAnalyze} disabled={!url.trim()}>
                <SearchIcon className="size-4" />
                분석
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            youtube.com, youtu.be 지원
          </p>

          {/* 분석 진행 상태 */}
          {(step === "extracting" || step === "analyzing") && (
            <div className="mt-6 flex flex-col gap-3">
              <ProgressStep
                label="자막 추출"
                status={step === "extracting" ? "active" : "done"}
              />
              <ProgressStep
                label="AI 분석 중..."
                status={step === "analyzing" ? "active" : "idle"}
              />
            </div>
          )}

          {/* 에러 */}
          {step === "error" && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
              <AlertTriangleIcon className="size-8 text-destructive/60" />
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={() => setStep("idle")}>
                다시 시도
              </Button>
            </div>
          )}

          {/* 결과 */}
          {step === "done" && result && (
            <div className="mt-6 flex flex-col gap-4">
              {/* 요약 */}
              <div className="text-sm">
                <span className="font-medium">&ldquo;{result.videoTitle}&rdquo;</span>
                {" "}에서{" "}
                <span className="font-semibold text-primary">
                  {result.places.length}개
                </span>{" "}
                장소 발견
                {result.isShorts && (
                  <span className="ml-2 text-xs text-amber-600">
                    (Shorts 영상 — 결과가 제한적일 수 있습니다)
                  </span>
                )}
              </div>

              {/* 카테고리 필터 칩 */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(["all", "restaurant", "attraction", "accommodation", "other"] as const).map(
                  (cat) => {
                    const count = categoryCounts[cat] || 0;
                    if (cat !== "all" && count === 0) return null;
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          filterCategory === cat
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {PLACE_CATEGORY_LABEL[cat]}
                        {cat !== "all" && ` (${count})`}
                      </button>
                    );
                  }
                )}
              </div>

              {/* 장소 목록 */}
              <div className="flex flex-col gap-1">
                {displayPlaces.map((place) => (
                  <PlaceRow
                    key={place.name}
                    place={place}
                    checked={checkedNames.has(place.name)}
                    expanded={expandedNames.has(place.name)}
                    onToggleCheck={() => toggleCheck(place.name)}
                    onToggleExpand={() => toggleExpand(place.name)}
                  />
                ))}
              </div>

              {/* 더 보기 */}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(true)}
                  className="self-center"
                >
                  더 보기 (+{filteredPlaces.length - INITIAL_SHOW_COUNT}개)
                  <ChevronDownIcon className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 하단 바 */}
        {step === "done" && result && (
          <div className="sticky bottom-0 flex items-center justify-between border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  allFilteredChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground"
                )}
              >
                {allFilteredChecked && <CheckIcon className="size-3" />}
              </span>
              전체 선택
            </button>
            <Button
              onClick={handleAddPlaces}
              disabled={selectedCount === 0 || isAdding}
              size="sm"
            >
              {isAdding ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  추가 중...
                </>
              ) : (
                `선택한 ${selectedCount}개 추가하기`
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── 서브 컴포넌트 ──

function ProgressStep({
  label,
  status,
}: {
  label: string;
  status: "idle" | "active" | "done";
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {status === "done" && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-3" />
        </div>
      )}
      {status === "active" && (
        <LoaderIcon className="size-5 animate-spin text-primary" />
      )}
      {status === "idle" && (
        <div className="h-5 w-5 rounded-full border-2 border-muted" />
      )}
      <span
        className={cn(
          status === "active" && "font-medium text-primary",
          status === "done" && "text-muted-foreground",
          status === "idle" && "text-muted-foreground/50"
        )}
      >
        {label}
      </span>
    </div>
  );
}

const CONFIDENCE_BADGE: Record<
  "high" | "medium" | "low",
  { label: string; className: string }
> = {
  high: { label: "", className: "" },
  medium: { label: "", className: "" },
  low: {
    label: "확인 필요",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

function PlaceRow({
  place,
  checked,
  expanded,
  onToggleCheck,
  onToggleExpand,
}: {
  place: ExtractedPlace;
  checked: boolean;
  expanded: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
}) {
  const badge = CONFIDENCE_BADGE[place.confidence];

  return (
    <div className="rounded-lg border bg-card transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          className={cn(
            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground"
          )}
        >
          {checked && <CheckIcon className="size-3" />}
        </button>

        <button
          onClick={onToggleExpand}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-medium line-clamp-1">
            {place.name}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {badge.label && (
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0", badge.className)}
              >
                {badge.label}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {PLACE_CATEGORY_LABEL[place.category]}
            </Badge>
            <ChevronDownIcon
              className={cn(
                "size-3.5 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>
        </button>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {place.timestamp && (
            <span className="mr-2 font-mono text-primary/70">
              {place.timestamp}
            </span>
          )}
          {place.context}
        </div>
      )}
    </div>
  );
}
