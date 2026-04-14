"use client";

import { useAuthStore } from "@/stores/auth-store";
import { UserMenu } from "@/components/layout/user-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">내 정보</h1>
      {user ? (
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">{user.display_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-lg">{user.display_name}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(user.created_at).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
              })}{" "}가입
            </p>
          </div>
          <UserMenu />
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      )}
    </div>
  );
}
