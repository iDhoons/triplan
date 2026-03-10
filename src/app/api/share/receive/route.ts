import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
