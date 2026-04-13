// src/components/content/ContentHistoryPanel.tsx
"use client";

import type { HistoryPost } from "@/hooks/useContentHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContentHistoryPanelProps {
  history: HistoryPost[];
  loading: boolean;
  onRestore: (post: HistoryPost) => void;
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

export function ContentHistoryPanel({ history, loading, onRestore }: ContentHistoryPanelProps) {
  if (!loading && history.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>이전 생성 기록 (최근 {history.length}개)</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((post) => (
            <li
              key={post.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {post.title ?? "제목 없음"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timeAgo(post.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-8 gap-1.5 text-xs"
                onClick={() => onRestore(post)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                복원
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
