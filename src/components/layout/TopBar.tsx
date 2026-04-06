"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_LABELS: Record<string, string> = {
  "/": "대시보드",
  "/accounts": "SNS 계정",
  "/calendar": "콘텐츠 캘린더",
  "/analytics": "성과 분석",
  "/engage": "댓글/DM 관리",
  "/content": "콘텐츠 생성",
  "/content/text": "텍스트 게시물",
  "/content/carousel": "카드뉴스 랩",
  "/content/blog": "블로그 아티클",
  "/content/bulk": "AI 대량 기획",
  "/content/repurpose": "콘텐츠 리퍼포징",
  "/content/short-form": "숏폼 영상",
};

interface TopBarProps {
  /** 모바일 햄버거 버튼 등 TopBar 왼쪽에 삽입할 슬롯 */
  mobileTrigger?: React.ReactNode;
}

export function TopBar({ mobileTrigger }: TopBarProps = {}) {
  const pathname = usePathname();
  const pageLabel = PAGE_LABELS[pathname] ?? "SNS 자동화";

  return (
    <header className="h-14 shrink-0 border-b bg-card flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {mobileTrigger}
        <span className="text-sm font-semibold text-foreground">{pageLabel}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/60 transition-colors"
          aria-label="알림"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>알림</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-muted-foreground justify-center py-4">
            새 알림이 없습니다.
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
