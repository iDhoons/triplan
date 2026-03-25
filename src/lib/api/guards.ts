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

// ─── Rate Limiter (in-memory, 프로덕션에서는 Upstash Redis 권장) ───

const rateLimitMaps = new Map<string, Map<string, { count: number; reset: number }>>();

export function checkRateLimit(
  key: string,
  userId: string,
  options: { windowMs?: number; maxRequests?: number } = {}
): boolean {
  const { windowMs = 60_000, maxRequests = 10 } = options;
  const now = Date.now();

  if (!rateLimitMaps.has(key)) {
    rateLimitMaps.set(key, new Map());
  }
  const map = rateLimitMaps.get(key)!;
  const entry = map.get(userId);

  if (!entry || now > entry.reset) {
    map.set(userId, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
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

    // body가 필요한 경우 clone하여 파싱
    if (request.method !== "GET") {
      try {
        body = await request.clone().json();
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
