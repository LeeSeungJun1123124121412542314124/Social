"use client";

import { useState, useEffect, useCallback } from "react";

export interface Account {
  id: string;
  platform: string;
  profileName: string;
  profileImage: string | null;
  profileUrl: string | null;
  followerCount: number;
  tokenExpiresAt: string | null;
  isActive: boolean;
  connectedAt: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.fetch("/api/accounts");
      const data = await res.json() as { success: boolean; data: Account[]; error?: { message: string } };
      if (!data.success) throw new Error(data.error?.message ?? "조회 실패");
      setAccounts(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const deleteAccount = useCallback(async (id: string) => {
    const res = await window.fetch(`/api/accounts/${id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean; error?: { message: string } };
    if (!data.success) throw new Error(data.error?.message ?? "삭제 실패");
    // 낙관적 업데이트
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { accounts, loading, error, refresh: fetch, deleteAccount };
}
