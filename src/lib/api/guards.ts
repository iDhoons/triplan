import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { errorResponse } from "@/lib/api/error-response";

// ─── Types ──────────────────────────────────────────────

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

interface MemberContext extends AuthContext {
  role: "admin" | "editor" | "viewer";
  tripId: string;
}

type AuthenticatedHandler = (
  request: Request,
  ctx: AuthContext
) => Promise<NextResponse>;

type MemberHandler = (
  request: Request,
  ctx: MemberContext
) => Promise<NextResponse>;

// ─── IP Rate Limiter (in-memory, 공개 엔드포인트용) ─────
// 인증 불필요 공개 엔드포인트(사진 프록시 등)에서 사용.
// 서버리스 재시작 시 초기화되므로 엄격한 제한이 필요할 때는 DB 기반을 사용할 것.

const _ipRateMap = new Map<string, { count: number; reset: number }>();

export function checkIpRateLimit(
  ip: string,
  options: { windowMs?: number; maxRequests?: number } = {}
): boolean {
  const { windowMs = 60_000, maxRequests = 120 } = options;
  const now = Date.now();
  const entry = _ipRateMap.get(ip);
  if (!entry || now > entry.reset) {
    _ipRateMap.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// ─── Rate Limiter (DB 기반, check_rate_limit RPC 사용) ───
//
// DB 마이그레이션: 20260407_rate_limit_db.sql
// - api_rate_limits 테이블 + check_rate_limit() SECURITY DEFINER 함수
// - 서버리스 인스턴스 간 상태 공유, 원자적 카운트 증가
//
// 테스트 환경: VITEST 플래그가 있으면 in-memory 폴백 사용
// (DB 연결 없이 단위 테스트 가능)

const _testRateLimitMaps = new Map<string, Map<string, { count: number; reset: number }>>();

function _checkRateLimitMemory(
  key: string,
  userId: string,
  windowMs: number,
  maxRequests: number
): boolean {
  const compositeKey = `${key}:${userId}`;
  if (!_testRateLimitMaps.has(key)) _testRateLimitMaps.set(key, new Map());
  const map = _testRateLimitMaps.get(key)!;
  const entry = map.get(compositeKey);
  const now = Date.now();
  if (!entry || now > entry.reset) {
    map.set(compositeKey, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export async function checkRateLimit(
  key: string,
  userId: string,
  options: { windowMs?: number; maxRequests?: number } = {}
): Promise<boolean> {
  const { windowMs = 60_000, maxRequests = 10 } = options;

  // 테스트 환경에서는 in-memory 폴백
  if (process.env.VITEST) {
    return _checkRateLimitMemory(key, userId, windowMs, maxRequests);
  }

  try {
    const supabase = await createClient();
    const compositeKey = `${key}:${userId}`;
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: compositeKey,
      p_window_ms: windowMs,
      p_max: maxRequests,
    });

    if (error) {
      // DB 오류 시 허용 (fail-open): 로그 후 통과
      console.error("[checkRateLimit] DB error, fail-open:", error.message);
      return true;
    }
    return data as boolean;
  } catch (err) {
    console.error("[checkRateLimit] Unexpected error, fail-open:", err);
    return true;
  }
}

// ─── Guards ─────────────────────────────────────────────

/**
 * 인증 확인 래퍼.
 * 로그인하지 않은 사용자에게 401을 반환한다.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request): Promise<NextResponse> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "Unauthorized");
    }

    return handler(request, { supabase, user });
  };
}

/**
 * 인증 + 여행 멤버십 확인 래퍼.
 * trip_id를 request body 또는 함수 인자로 받아서 멤버십을 검증한다.
 */
export function withTripMember(
  getTripId: (request: Request, body: unknown) => string | null,
  handler: MemberHandler
) {
  return withAuth(async (request, { supabase, user }) => {
    let body: unknown = null;

    // body가 필요한 경우 clone하여 파싱 (빈 body DELETE 등은 null 유지)
    if (request.method !== "GET") {
      try {
        const text = await request.clone().text();
        if (text.trim()) {
          body = JSON.parse(text);
        }
      } catch {
        return errorResponse("BAD_REQUEST", "Invalid JSON body");
      }
    }

    const tripId = getTripId(request, body);
    if (!tripId) {
      return errorResponse("BAD_REQUEST", "trip_id is required");
    }

    const { data: membership } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return errorResponse("FORBIDDEN", "Access denied");
    }

    return handler(request, {
      supabase,
      user,
      role: membership.role as "admin" | "editor" | "viewer",
      tripId,
    });
  });
}

/**
 * 인증 + 여행 멤버십 + 편집 권한 확인 래퍼.
 * viewer 역할은 403을 반환한다.
 */
export function withTripEditor(
  getTripId: (request: Request, body: unknown) => string | null,
  handler: MemberHandler
) {
  return withTripMember(getTripId, async (request, ctx) => {
    if (ctx.role === "viewer") {
      return errorResponse("FORBIDDEN", "Viewer는 이 작업을 수행할 수 없습니다");
    }
    return handler(request, ctx);
  });
}
