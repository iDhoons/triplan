import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guards";

export const POST = withAuth(async (request) => {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const text = formData.get("text") as string;
  const url = formData.get("url") as string;

  // 공유받은 데이터를 반환 → 클라이언트에서 장소 등록 폼에 채움
  return NextResponse.json({
    title: title || "",
    text: text || "",
    url: url || "",
  });
});
