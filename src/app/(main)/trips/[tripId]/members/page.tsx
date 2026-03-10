"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
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
import type { Trip, TripMember, MemberRole } from "@/types/database";
import { Copy, Check, UserMinus } from "lucide-react";

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

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const isAdmin = members.some(
    (m) => m.user_id === user?.id && m.role === "admin"
  );

  useEffect(() => {
    fetchAll();
  }, [tripId]);

  async function fetchAll() {
    setLoading(true);
    const [tripRes, membersRes] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase
        .from("trip_members")
        .select(
          "*, profile:profiles(id, display_name, avatar_url, created_at)"
        )
        .eq("trip_id", tripId),
    ]);

    if (tripRes.data) setTrip(tripRes.data as Trip);
    if (membersRes.data) setMembers(membersRes.data as TripMember[]);
    setLoading(false);
  }

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

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setUpdatingRole(memberId);
    await supabase
      .from("trip_members")
      .update({ role: newRole })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    setUpdatingRole(null);
  }

  async function handleRemoveMember(memberId: string, userId: string) {
    // Prevent removing self or last admin
    const admins = members.filter((m) => m.role === "admin");
    const target = members.find((m) => m.id === memberId);
    if (target?.role === "admin" && admins.length <= 1) {
      alert("마지막 관리자는 내보낼 수 없습니다.");
      return;
    }

    if (!confirm("정말 이 멤버를 내보내시겠습니까?")) return;

    await supabase.from("trip_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-16" />
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
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            링크를 공유하면 누구나 편집자로 참여할 수 있어요.
          </p>
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
    </div>
  );
}
