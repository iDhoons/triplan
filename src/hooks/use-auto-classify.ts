import { useState, useCallback, useRef } from "react";
import { classifyByKeyword } from "@/lib/checklist/classify";
import type { ChecklistCategory } from "@/types/database";

type ClassifySource = "keyword" | "ai" | "default" | null;

interface UseAutoClassifyOptions {
  onClassified?: (category: ChecklistCategory, source: ClassifySource) => void;
}

export function useAutoClassify(options?: UseAutoClassifyOptions) {
  const [classifiedCategory, setClassifiedCategory] =
    useState<ChecklistCategory | null>(null);
  const [source, setSource] = useState<ClassifySource>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onClassifiedRef = useRef(options?.onClassified);
  onClassifiedRef.current = options?.onClassified;

  const classify = useCallback((title: string) => {
    // 이전 요청 취소
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!title.trim()) {
      setClassifiedCategory(null);
      setSource(null);
      setIsClassifying(false);
      return;
    }

    // 1차: 키워드 매칭 (즉시)
    const keywordResult = classifyByKeyword(title);
    if (keywordResult) {
      setClassifiedCategory(keywordResult);
      setSource("keyword");
      setIsClassifying(false);
      onClassifiedRef.current?.(keywordResult, "keyword");
      return;
    }

    // 2차: Gemini (500ms 디바운스)
    setIsClassifying(true);
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/checklist/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setClassifiedCategory(data.category);
        setSource(data.source);
        onClassifiedRef.current?.(data.category, data.source);
      } catch {
        if (!controller.signal.aborted) {
          setClassifiedCategory("shared");
          setSource("default");
          onClassifiedRef.current?.("shared", "default");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsClassifying(false);
        }
      }
    }, 500);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    setClassifiedCategory(null);
    setSource(null);
    setIsClassifying(false);
  }, []);

  return { classifiedCategory, source, isClassifying, classify, reset };
}
