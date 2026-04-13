// src/hooks/useContentHistory.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export interface HistoryPost {
  id: string;
  title: string | null;
  contentText: string | null;
  contentData: string | null;
  status: string;
  createdAt: string;
}

export interface AutoSavePayload {
  title?: string;
  contentText?: string;
  contentData?: string;
}

/**
 * 콘텐츠 타입별 최근 N개 히스토리를 조회하고 자동저장 기능을 제공하는 훅.
 *
 * @param type  Post.type 값 ("text" | "carousel" | "blog" | "bulk" | "repurpose")
 * @param limit 조회할 최대 개수 (기본 5)
 */
export function useContentHistory(type: string, limit = 5) {
  const [history, setHistory] = useState<HistoryPost[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await window.fetch(
        `/api/content?type=${encodeURIComponent(type)}&limit=${limit}`
      );
      const data = await res.json() as { success: boolean; data: HistoryPost[] };
      if (data.success) setHistory(data.data);
    } catch {
      // 히스토리 로드 실패는 UI를 방해하지 않도록 조용히 처리
    } finally {
      setHistoryLoading(false);
    }
  }, [type, limit]);

  // 자동저장 후 히스토리 즉시 갱신
  const autoSave = useCallback(
    async (payload: AutoSavePayload): Promise<void> => {
      try {
        await window.fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...payload }),
        });
        // 저장 후 히스토리 즉시 갱신
        await refreshHistory();
      } catch {
        // 자동저장 실패는 조용히 처리 (사용자 작업 방해 않음)
      }
    },
    [type, refreshHistory]
  );

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  return { history, historyLoading, refreshHistory, autoSave };
}
