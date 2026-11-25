import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FolderOpen,
  Headphones,
  LayoutDashboard,
  Repeat,
  Settings,
  Swords,
  Target,
  Timer,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Study",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/courses", label: "Courses", icon: BookOpen },
      { href: "/timer", label: "Study Timer", icon: Timer },
      { href: "/focus", label: "Focus Mode", icon: Headphones },
      { href: "/vault", label: "Learning Vault", icon: FolderOpen },
    ],
  },
  {
    title: "Together",
    items: [
      { href: "/groups", label: "Study Groups", icon: Users },
      { href: "/arena", label: "Pledges & Dares", icon: Swords },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/goals", label: "Goals & Missions", icon: Target },
      { href: "/habits", label: "Habits", icon: Repeat },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/groups", label: "Groups", icon: Users },
];
