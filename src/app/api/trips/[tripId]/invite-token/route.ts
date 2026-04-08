import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";
import { nanoid } from "nanoid";

const EXPIRY_DAYS = 7;

// POST /api/trips/[tripId]/invite-token — 게스트 초대 토큰 생성 (admin/editor 전용)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Authentication required");

  const { tripId } = await params;

  // 편집자/관리자만 토큰 생성 가능
  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || !["admin", "editor"].includes(member.role)) {
    return errorResponse("FORBIDDEN", "Only trip admins and editors can create invite tokens");
  }

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
}

// GET /api/trips/[tripId]/invite-token — 활성 토큰 목록 조회 (멤버 전용)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Authentication required");

  const { tripId } = await params;

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return errorResponse("FORBIDDEN", "Not a trip member");

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
}

// DELETE /api/trips/[tripId]/invite-token — 토큰 폐기 (admin/editor 전용)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Authentication required");

  const { tripId } = await params;

  const { member: memberCheck } = await (async () => {
    const { data } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    return { member: data };
  })();

  if (!memberCheck || !["admin", "editor"].includes(memberCheck.role)) {
    return errorResponse("FORBIDDEN", "Only trip admins and editors can revoke invite tokens");
  }

  let tokenId: string;
  try {
    const body = await request.json();
    tokenId = body.tokenId;
    if (!tokenId || typeof tokenId !== "string") throw new Error();
  } catch {
    return errorResponse("BAD_REQUEST", "tokenId is required");
  }

  const { error } = await supabase
    .from("invite_tokens")
    .delete()
    .eq("id", tokenId)
    .eq("trip_id", tripId); // trip_id 일치 확인 (다른 여행 토큰 삭제 방지)

  if (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to revoke invite token");
  }

  return NextResponse.json({ success: true });
}
