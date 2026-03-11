import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

interface MemberContext extends AuthContext {
  role: "admin" | "editor" | "viewer";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
    }

    const tripId = getTripId(request, body);
    if (!tripId) {
      return NextResponse.json(
        { error: "trip_id가 필요합니다" },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "해당 여행에 접근할 수 없습니다" },
        { status: 403 }
      );
    }

    return handler(request, {
      supabase,
      user,
      role: membership.role as "admin" | "editor" | "viewer",
    });
  });
}
