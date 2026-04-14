// src/components/content/HistorySearchDialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContentSearch, type SinceOption } from "@/hooks/useContentSearch";
import type { HistoryPost } from "@/hooks/useContentHistory";

export type SearchableType = "text" | "blog" | "carousel";

const TYPE_TABS: { value: SearchableType; label: string }[] = [
  { value: "text", label: "텍스트" },
  { value: "blog", label: "블로그" },
  { value: "carousel", label: "카드뉴스" },
];

const SINCE_OPTIONS: { value: SinceOption; label: string }[] = [
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "all", label: "전체" },
];

interface HistorySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 항목 선택 시 호출. 본문 매핑 책임은 부모가 가진다. */
  onSelect: (post: HistoryPost, originType: SearchableType) => void;
}

function timeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function HistorySearchDialog({
  open,
  onOpenChange,
  onSelect,
}: HistorySearchDialogProps) {
  const [type, setType] = useState<SearchableType>("text");
  const [since, setSince] = useState<SinceOption>("7d");

  // 모달이 열려 있을 때만 조회 (null 전달 시 훅 내부에서 조회 건너뜀)
  const { results, loading } = useContentSearch(
    open ? { type, since, limit: 20 } : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>이전 생성 결과에서 불러오기</DialogTitle>
          <DialogDescription>
            타입과 기간을 선택해 과거 콘텐츠를 리퍼포징 원본으로 사용할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 타입 탭 */}
        <div className="flex gap-1.5 border-b pb-2">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                type === t.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 날짜 프리셋 */}
        <div className="flex gap-1.5">
          {SINCE_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSince(s.value)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                since === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 결과 리스트 */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              해당 조건의 결과가 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(post, type)}
                    className="w-full text-left rounded-lg border border-border bg-muted/20 px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <p className="truncate font-medium text-sm">
                      {post.title ?? "제목 없음"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(post.createdAt)}
                    </p>
                    {post.contentText && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {post.contentText.slice(0, 120)}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
