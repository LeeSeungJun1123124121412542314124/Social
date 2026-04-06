"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Link2,
  Layers,
  CalendarDays,
  BarChart2,
  MessageSquare,
  Zap,
  Repeat2,
  BookOpen,
  Video,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainItems = [
  { label: "홈", href: "/", icon: LayoutDashboard },
  { label: "SNS 계정", href: "/accounts", icon: Link2 },
  { label: "캘린더", href: "/calendar", icon: CalendarDays },
  { label: "분석", href: "/analytics", icon: BarChart2 },
];

const contentItems = [
  { label: "카드뉴스 랩", href: "/content/carousel", icon: Layers },
  { label: "숏폼 생성", href: "/content/short-form", icon: Video },
  { label: "AI 대량 기획", href: "/content/bulk", icon: Zap },
  { label: "리퍼포징", href: "/content/repurpose", icon: Repeat2 },
  { label: "블로그", href: "/content/blog", icon: BookOpen },
];

const manageItems = [
  { label: "댓글/DM", href: "/engage", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar flex flex-col">
      {/* 로고 */}
      <div className="h-14 flex items-center gap-2 px-4 border-b">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="font-bold text-base tracking-tight text-foreground">SNS 자동화</span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {mainItems.map((item) => (
          <SidebarItem key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <NavGroupLabel>콘텐츠</NavGroupLabel>
        {contentItems.map((item) => (
          <SidebarItem key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <NavGroupLabel>관리</NavGroupLabel>
        {manageItems.map((item) => (
          <SidebarItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      {/* 하단 다크모드 토글 */}
      <div className="border-t p-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground transition-colors"
          aria-label="다크모드 전환"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          <span>{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
        </button>
      </div>
    </aside>
  );
}

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-3 pb-1 px-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        {children}
      </p>
    </div>
  );
}

function SidebarItem({
  label,
  href,
  icon: Icon,
  active,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "font-medium text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 inset-y-1 w-0.5 rounded-full bg-primary" />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
