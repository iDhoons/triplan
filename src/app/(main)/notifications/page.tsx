import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Bell className="w-12 h-12 mb-4" />
      <p className="text-lg font-medium">알림</p>
      <p className="text-sm mt-1">준비 중입니다</p>
    </div>
  );
}
