// src/hooks/useContentSearch.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { HistoryPost } from "@/hooks/useContentHistory";

export type SinceOption = "7d" | "30d" | "all";

export interface SearchParams {
  type: string;
  since: SinceOption;
  limit?: number;
}

/**
 * 히스토리 검색 모달용 조회 훅.
 * type/since 변경 시 즉시 재조회. 자동저장 기능은 없다.
 * params가 null이면 조회하지 않고 결과를 빈 배열로 초기화한다 (모달 닫힘 상태).
 */
export function useContentSearch(params: SearchParams | null) {
  const [results, setResults] = useState<HistoryPost[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (p: SearchParams) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        type: p.type,
        limit: String(p.limit ?? 20),
      });
      if (p.since !== "all") qs.set("since", p.since);
      const res = await window.fetch(`/api/content?${qs.toString()}`);
      const data = (await res.json()) as { success: boolean; data: HistoryPost[] };
      if (data.success) setResults(data.data);
    } catch {
      // 조회 실패는 조용히 처리 — 빈 목록 표시
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!params) {
      setResults([]);
      return;
    }
    void search(params);
  }, [params, search]);

  return { results, loading };
}
