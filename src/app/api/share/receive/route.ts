import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

/**
 * POST /api/share/receive
 * PWA Share Target으로 공유된 데이터를 수신한다.
 *
 * @TASK T7.6 - FormData null 체크 + typeof 검증 + 길이 제한
 * @SPEC docs/TASKS.md#Phase-7
 */
export const POST = withAuth(async (request) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid form data");
  }

  const rawTitle = formData.get("title");
  const rawText = formData.get("text");
  const rawUrl = formData.get("url");

  // null 체크 + typeof 검증 — File 등 비문자열 타입 거부
  const title =
    rawTitle != null && typeof rawTitle === "string"
      ? rawTitle.slice(0, 500)
      : "";
  const text =
    rawText != null && typeof rawText === "string"
      ? rawText.slice(0, 500)
      : "";
  const url =
    rawUrl != null && typeof rawUrl === "string"
      ? rawUrl.slice(0, 500)
      : "";

  // 공유받은 데이터를 반환 → 클라이언트에서 장소 등록 폼에 채움
  return NextResponse.json({ title, text, url });
});
