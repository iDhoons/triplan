import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { GoogleAddressComponent } from "@/types/database"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * address_components에서 특정 타입의 컴포넌트를 찾아 longText 반환
 */
function findComponent(
  components: GoogleAddressComponent[],
  type: string
): string | null {
  const comp = components.find((c) => c.types.includes(type));
  return comp?.longText ?? null;
}

/**
 * 카드용 짧은 한글 주소: "타이베이, 신이구" (큰→작은, 한국식)
 * components가 없으면 fallbackAddress를 반환
 */
export function formatShortAddress(
  components: GoogleAddressComponent[] | null | undefined,
  fallbackAddress?: string | null
): string | null {
  if (!components || components.length === 0) {
    return fallbackAddress ?? null;
  }

  // 우선순위: locality(시) > administrative_area_level_1(도/주)
  const locality =
    findComponent(components, "locality") ??
    findComponent(components, "administrative_area_level_1");
  const sublocality =
    findComponent(components, "sublocality_level_1") ??
    findComponent(components, "sublocality");

  if (locality && sublocality) {
    return `${locality}, ${sublocality}`;
  }
  if (locality) {
    return locality;
  }

  return fallbackAddress ?? null;
}

/**
 * 상세용 전체 한글 주소
 * components가 없으면 fallbackAddress를 반환
 */
export function formatFullAddress(
  components: GoogleAddressComponent[] | null | undefined,
  fallbackAddress?: string | null
): string | null {
  if (!components || components.length === 0) {
    return fallbackAddress ?? null;
  }

  // 큰 단위부터 조합 (한국식: 나라 > 시 > 구 > 도로 > 번호)
  const parts: string[] = [];
  const country = findComponent(components, "country");
  const admin1 = findComponent(components, "administrative_area_level_1");
  const locality = findComponent(components, "locality");
  const sublocality =
    findComponent(components, "sublocality_level_1") ??
    findComponent(components, "sublocality");
  const route = findComponent(components, "route");
  const streetNumber = findComponent(components, "street_number") ??
    findComponent(components, "premise");

  if (country) parts.push(country);
  if (admin1 && admin1 !== locality) parts.push(admin1);
  if (locality) parts.push(locality);
  if (sublocality) parts.push(sublocality);
  if (route) parts.push(route);
  if (streetNumber) parts.push(streetNumber);

  return parts.length > 0 ? parts.join(" ") : (fallbackAddress ?? null);
}

/**
 * price_level 숫자를 ₩ 기호로 변환 (0~4)
 */
export function formatPriceLevel(level: number | null): string | null {
  if (level === null || level === undefined) return null;
  if (level === 0) return "무료";
  return "₩".repeat(Math.min(level, 4));
}

/**
 * 인앱 브라우저(WebView) 감지
 * 카카오톡, 인스타그램, 페이스북, 네이버, 라인 등의 인앱 브라우저를 감지한다.
 * Google OAuth는 WebView에서 403 disallowed_useragent 에러를 발생시킨다.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|SamsungBrowser\/.*CrossApp|wv\)|\.NET.*WebView/i.test(ua);
}

/**
 * 현재 URL을 외부 브라우저에서 여는 Intent URL 생성 (Android)
 */
export function getExternalBrowserUrl(url: string): string {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    return `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
  }
  // iOS: Safari로 열기 (x-safari-https는 지원 안 되므로 클립보드 복사 안내가 더 적절)
  return url;
}
