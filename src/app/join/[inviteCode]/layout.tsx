import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ inviteCode: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { inviteCode } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("title, destination, start_date, end_date")
    .eq("invite_code", inviteCode)
    .single();

  if (!trip) {
    return {
      title: "여행 초대 | 여행 플래너",
      description: "초대 링크가 만료되었거나 존재하지 않습니다.",
    };
  }

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("ko-KR")} ~ ${new Date(trip.end_date).toLocaleDateString("ko-KR")}`
      : "";

  const title = `${trip.title} 초대 | 여행 플래너`;
  const description = [
    trip.destination && `${trip.destination}`,
    dateRange,
    "함께 여행을 계획해보세요!",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title,
    description,
    openGraph: {
      title: `${trip.title}에 초대받았어요!`,
      description,
      type: "website",
      siteName: "여행 플래너",
    },
    twitter: {
      card: "summary",
      title: `${trip.title}에 초대받았어요!`,
      description,
    },
  };
}

export default function JoinLayout({ children }: Props) {
  return <>{children}</>;
}
