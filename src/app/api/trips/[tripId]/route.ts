import { withTripMember } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";

// DELETE /api/trips/[tripId] — 여행 삭제 (admin 전용)
export const DELETE = withTripMember(
  (request) => request.url.match(/\/trips\/([^/]+)/)?.[1] ?? null,
  async (_request, { supabase, role, tripId }) => {
    if (role !== "admin") {
      return errorResponse("FORBIDDEN", "관리자만 여행을 삭제할 수 있습니다");
    }

    const { error } = await supabase.from("trips").delete().eq("id", tripId);

    if (error) {
      return errorResponse("INTERNAL_ERROR", "여행 삭제에 실패했습니다");
    }

    return NextResponse.json({ success: true });
  },
);
