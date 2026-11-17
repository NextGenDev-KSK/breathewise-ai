import { CalendarDays, Gauge, House, Settings, Sparkles, Sunrise, TramFront, Trophy, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/forecast", label: "Forecast", icon: CalendarDays },
  { href: "/plan", label: "My Clean-Air Day", icon: Sunrise },
  { href: "/indoor", label: "Indoor Air", icon: House },
  { href: "/commute", label: "Smart Commute", icon: TramFront },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/progress", label: "My Progress", icon: Trophy },
  { href: "/settings", label: "Settings & Data", icon: Settings },
];
