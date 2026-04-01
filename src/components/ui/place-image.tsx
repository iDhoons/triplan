"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { cn, placeImageUrl } from "@/lib/utils";
import type { ReactNode } from "react";

interface PlaceImageProps {
  /** 이미지 URL (proxy URL 또는 storage URL) */
  src: string | undefined;
  alt: string;
  /** proxy URL의 maxWidth를 교체할 크기 (200/400/800/1200) */
  width?: number;
  className?: string;
  /** 에러/미존재 시 표시할 fallback (기본: MapPin 아이콘) */
  fallbackIcon?: ReactNode;
}

/**
 * 장소 이미지 공통 컴포넌트.
 * - proxy URL이면 width에 맞게 maxWidth 교체
 * - 로드 실패 시 상태 기반 fallback (DOM 조작 없음)
 * - eslint-disable은 이 파일에만 한 번
 */
export function PlaceImage({
  src,
  alt,
  width,
  className,
  fallbackIcon,
}: PlaceImageProps) {
  const [error, setError] = useState(false);
  const url = src && width ? placeImageUrl(src, width) : src;

  if (!url || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted",
          className
        )}
      >
        {fallbackIcon ?? (
          <MapPin className="size-5 text-muted-foreground/30" />
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
