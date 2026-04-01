"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useTrip, useInvalidateTrip } from "@/hooks/use-trip";
import { useTripMembers } from "@/hooks/use-trip-members";
import { queryKeys } from "@/hooks/query-keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MemberContribution } from "@/components/members/member-contribution";
import { ActivityTimeline } from "@/components/members/activity-timeline";
import { ChecklistProgress } from "@/components/members/checklist-progress";
import type { TripMember, MemberRole } from "@/types/database";
import { Copy, Check, UserMinus, RefreshCw, Share2 } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "관리자",
  editor: "편집자",
  viewer: "뷰어",
};

const ROLE_VARIANTS: Record<
  MemberRole,
  "default" | "secondary" | "outline"
> = {
  admin: "default",
  editor: "secondary",
  viewer: "outline",
};

export default function MembersPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { user } = useAuthStore();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: trip = null } = useTrip(tripId);
  const { setData: setTripData } = useInvalidateTrip();
  const { data: members = [], isLoading: loading } = useTripMembers(tripId);

  const [copied, setCopied] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && !!navigator.share
  );

  const isAdmin = members.some(
    (m) => m.user_id === user?.id && m.role === "admin"
  );

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.members.byTrip(tripId) });

  function getInviteUrl() {
    if (!trip) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/join/${trip.invite_code}`;
  }

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(getInviteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!trip) return;
    const dateRange = trip.start_date && trip.end_date
      ? ` (${new Date(trip.start_date).toLocaleDateString("ko-KR")}~${new Date(trip.end_date).toLocaleDateString("ko-KR")})`
      : "";
    try {
      await navigator.share({
        title: `${trip.title} 초대`,
        text: `${trip.destination ?? "여행"}${dateRange}에 함께 가요!`,
        url: getInviteUrl(),
      });
    } catch (err) {
      // 사용자가 공유를 취소한 경우 무시
      if ((err as Error).name !== "AbortError") {
        toast.error("공유에 실패했습니다");
      }
    }
  }

  async function handleRegenerateInvite() {
    if (!trip) return;
    const newCode = nanoid(10);
    const { error } = await supabase
      .from("trips")
      .update({ invite_code: newCode })
      .eq("id", trip.id);
    if (error) {
      toast.error("초대 코드 재생성에 실패했습니다.");
      return;
    }
    setTripData(tripId, { ...trip, invite_code: newCode });
    toast.success("초대 코드가 재생성되었습니다. 이전 링크는 더 이상 사용할 수 없어요.");
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setUpdatingRole(memberId);
    const { error } = await supabase
      .from("trip_members")
      .update({ role: newRole })
      .eq("id", memberId);
    setUpdatingRole(null);
    if (error) {
      toast.error("역할 변경에 실패했습니다.");
      return;
    }
    await invalidateMembers();
  }

  async function handleRemoveMember(memberId: string, userId: string) {
    // Prevent removing self or last admin
    const admins = members.filter((m) => m.role === "admin");
    const target = members.find((m) => m.id === memberId);
    if (target?.role === "admin" && admins.length <= 1) {
      toast.error("마지막 관리자는 내보낼 수 없어요.");
      return;
    }

    const removedMember = target;
    await supabase.from("trip_members").delete().eq("id", memberId);
    // Optimistic removal via query cache
    queryClient.setQueryData<TripMember[]>(queryKeys.members.byTrip(tripId), (old) =>
      old?.filter((m) => m.id !== memberId)
    );
    toast("멤버를 내보냈어요", {
      action: {
        label: "되돌리기",
        onClick: async () => {
          if (!removedMember) return;
          await supabase.from("trip_members").insert({
            id: removedMember.id,
            trip_id: tripId,
            user_id: userId,
            role: removedMember.role,
          });
          await invalidateMembers();
          toast.success("멤버가 복원되었어요");
        },
      },
      duration: 5000,
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full animate-shimmer shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-1/3 rounded animate-shimmer" />
                <div className="h-3 w-1/5 rounded animate-shimmer" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          멤버{" "}
          <span className="text-muted-foreground text-base font-normal">
            {members.length}명
          </span>
        </h2>
      </div>

      {/* Invite link */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-2">초대 링크</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate text-muted-foreground">
              {getInviteUrl()}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyInvite}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-green-600" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  복사
                </>
              )}
            </Button>
            {canShare && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                공유
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              링크를 공유하면 누구나 편집자로 참여할 수 있어요.
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={handleRegenerateInvite}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                title="이전 초대 링크를 무효화하고 새 코드를 생성합니다"
              >
                <RefreshCw className="w-3 h-3" />
                재생성
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Member list */}
      <div className="space-y-2">
        {members.map((member) => {
          const isSelf = member.user_id === user?.id;
          const isLastAdmin =
            member.role === "admin" &&
            members.filter((m) => m.role === "admin").length <= 1;

          return (
            <Card key={member.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <Avatar>
                  <AvatarImage
                    src={member.profile?.avatar_url ?? undefined}
                  />
                  <AvatarFallback>
                    {member.profile?.display_name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {member.profile?.display_name ?? "알 수 없음"}
                    </p>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">(나)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(member.joined_at).toLocaleDateString("ko-KR")} 참여
                  </p>
                </div>

                {/* Role badge / selector */}
                {isAdmin && !isSelf ? (
                  <Select
                    value={member.role}
                    onValueChange={(v) =>
                      v && handleRoleChange(member.id, v as MemberRole)
                    }
                    disabled={updatingRole === member.id}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">관리자</SelectItem>
                      <SelectItem value="editor">편집자</SelectItem>
                      <SelectItem value="viewer">뷰어</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={ROLE_VARIANTS[member.role]}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                )}

                {/* Remove button (admin only, not self, not last admin) */}
                {isAdmin && !isSelf && !isLastAdmin && (
                  <button
                    onClick={() =>
                      handleRemoveMember(member.id, member.user_id)
                    }
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="내보내기"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Dashboard */}
      <Tabs defaultValue="contribution">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="contribution">기여도</TabsTrigger>
          <TabsTrigger value="activity">활동</TabsTrigger>
          <TabsTrigger value="checklist">체크리스트</TabsTrigger>
        </TabsList>

        <TabsContent value="contribution" className="mt-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <MemberContribution tripId={tripId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <ActivityTimeline tripId={tripId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <ChecklistProgress tripId={tripId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
