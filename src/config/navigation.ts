import {
  Home,
  Bell,
  User,
  MapPin,
  Calendar,
  Wallet,
  BookOpen,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const globalNav: NavItem[] = [
  { href: "/dashboard", label: "내 여행", icon: Home },
  { href: "/notifications", label: "알림", icon: Bell },
  { href: "/profile", label: "내 정보", icon: User },
];

export const tripNav: NavItem[] = [
  { href: "places", label: "장소", icon: MapPin },
  { href: "schedule", label: "일정", icon: Calendar },
  { href: "budget", label: "예산", icon: Wallet },
  { href: "journal", label: "후기", icon: BookOpen },
  { href: "members", label: "멤버", icon: Users },
];

export function getTripTabHref(tripId: string, tabHref: string): string {
  return `/trips/${tripId}/${tabHref}`;
}
