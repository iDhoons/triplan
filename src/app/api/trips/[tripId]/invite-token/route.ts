import { withTripEditor, withTripMember } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";
import { nanoid } from "nanoid";
import { z } from "zod";

const EXPIRY_DAYS = 7;
const TRIP_ID_PATTERN = /\/trips\/([^/]+)\/invite-token/;

const getTripIdFromRequest = (request: Request) =>
  request.url.match(TRIP_ID_PATTERN)?.[1] ?? null;

const deleteTokenSchema = z.object({
  tokenId: z.string().min(1),
});

// POST /api/trips/[tripId]/invite-token — 게스트 초대 토큰 생성 (admin/editor 전용)
export const POST = withTripEditor(getTripIdFromRequest, async (request, { supabase, user, tripId }) => {
  const token = nanoid(21);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  const { data: inviteToken, error } = await supabase
    .from("invite_tokens")
    .insert({
      trip_id: tripId,
      token,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, token, expires_at, created_at")
    .single();

  if (error || !inviteToken) {
    console.error("[invite-token] create error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create invite token");
  }

  const origin = request.headers.get("origin") ?? "";
  const guestUrl = `${origin}/join/${inviteToken.token}`;

  return NextResponse.json(
    {
      id: inviteToken.id,
      token: inviteToken.token,
      url: guestUrl,
      expires_at: inviteToken.expires_at,
      created_at: inviteToken.created_at,
    },
    { status: 201 },
  );
});

// GET /api/trips/[tripId]/invite-token — 활성 토큰 목록 조회 (멤버 전용)
export const GET = withTripMember(getTripIdFromRequest, async (request, { supabase, tripId }) => {
  const { data: tokens, error } = await supabase
    .from("invite_tokens")
    .select("id, token, expires_at, created_at")
    .eq("trip_id", tripId)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to fetch invite tokens");
  }

  const origin = request.headers.get("origin") ?? "";
  return NextResponse.json({
    tokens: (tokens ?? []).map((t) => ({
      id: t.id,
      token: t.token,
      url: `${origin}/join/${t.token}`,
      expires_at: t.expires_at,
      created_at: t.created_at,
    })),
  });
});

// DELETE /api/trips/[tripId]/invite-token — 토큰 폐기 (admin/editor 전용)
export const DELETE = withTripEditor(getTripIdFromRequest, async (request, { supabase, tripId }) => {
  let parsedBody: z.infer<typeof deleteTokenSchema>;
  try {
    const body = await request.json();
    const result = deleteTokenSchema.safeParse(body);
    if (!result.success) throw new Error("invalid body");
    parsedBody = result.data;
  } catch {
    return errorResponse("BAD_REQUEST", "tokenId is required");
  }

  const { error } = await supabase
    .from("invite_tokens")
    .delete()
    .eq("id", parsedBody.tokenId)
    .eq("trip_id", tripId); // trip_id 일치 확인 (다른 여행 토큰 삭제 방지)

  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to revoke invite token");
  }

  return NextResponse.json({ success: true });
});
