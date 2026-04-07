"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

interface GeolocationState {
  coords: GeoCoords | null;
  error: string | null;
  /** watchPosition이 활성화된 상태 */
  isActive: boolean;
  /** 위치 추적 시작 여부 (사용자가 enable 호출 전) */
  isEnabled: boolean;
}

/**
 * 포그라운드에서만 동작하는 Geolocation watchPosition 훅.
 * - visibility API 연동: 탭이 숨겨지면 추적 중단, 다시 보이면 재시작
 * - enable/disable로 명시적 제어 가능
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    error: null,
    isActive: false,
    isEnabled: false,
  });

  const watchIdRef = useRef<number | null>(null);

  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({
        ...s,
        error: "이 브라우저는 위치 정보를 지원하지 않습니다.",
        isActive: false,
      }));
      return;
    }
    if (watchIdRef.current !== null) return; // 이미 감시 중

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setState((s) => ({
          ...s,
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          error: null,
          isActive: true,
        }));
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "위치 정보 접근이 거부되었습니다.",
          2: "위치를 확인할 수 없습니다.",
          3: "위치 요청 시간이 초과되었습니다.",
        };
        setState((s) => ({
          ...s,
          error: messages[err.code] ?? "위치 정보를 가져오는 중 오류가 발생했습니다.",
          isActive: false,
        }));
      },
      {
        enableHighAccuracy: false, // 배터리 절약
        maximumAge: 30_000,        // 30초 이내 캐시 허용
        timeout: 10_000,
      }
    );

    setState((s) => ({ ...s, isActive: true }));
  }, []);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((s) => ({ ...s, isActive: false }));
  }, []);

  /** 사용자가 명시적으로 추적을 시작 */
  const enable = useCallback(() => {
    setState((s) => ({ ...s, isEnabled: true }));
    startWatch();
  }, [startWatch]);

  /** 사용자가 명시적으로 추적을 중단 */
  const disable = useCallback(() => {
    setState((s) => ({ ...s, isEnabled: false, coords: null }));
    stopWatch();
  }, [stopWatch]);

  // 탭 visibility 변화에 따라 watch 일시 중단/재시작
  useEffect(() => {
    if (!state.isEnabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopWatch();
      } else {
        startWatch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.isEnabled, startWatch, stopWatch]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, enable, disable };
}
