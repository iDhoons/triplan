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

  const MAX_FIELD_LENGTH = 500;
  const safeString = (v: FormDataEntryValue | null) =>
    v != null && typeof v === "string" ? v.slice(0, MAX_FIELD_LENGTH) : "";

  const title = safeString(rawTitle);
  const text = safeString(rawText);
  const url = safeString(rawUrl);

  // 공유받은 데이터를 반환 → 클라이언트에서 장소 등록 폼에 채움
  return NextResponse.json({ title, text, url });
});
