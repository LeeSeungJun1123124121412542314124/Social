"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // SheetTrigger는 base-ui Dialog.Trigger 기반 — asChild 없음
  // className으로 스타일을 직접 적용
  const mobileTrigger = (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger
        className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/60 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-56" showCloseButton={false}>
        <Sidebar />
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex h-full">
      {/* 데스크탑 사이드바 — 모바일에서 숨김 */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar mobileTrigger={mobileTrigger} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
