import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripLayoutClient from "./trip-layout-client";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  // 현재 사용자 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // 여행 멤버십 확인
  const { data: membership } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    notFound();
  }

  return <TripLayoutClient>{children}</TripLayoutClient>;
}
