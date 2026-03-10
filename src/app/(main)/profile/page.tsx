"use client";

import { useAuthStore } from "@/stores/auth-store";
import { UserMenu } from "@/components/layout/user-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">내 정보</h1>
      {user && (
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">{user.display_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-lg">{user.display_name}</p>
            <p className="text-sm text-muted-foreground">{user.display_name}</p>
          </div>
          <UserMenu />
        </div>
      )}
    </div>
  );
}
