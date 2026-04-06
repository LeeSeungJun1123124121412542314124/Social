"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenerateTextInput, GeneratedText, GenerateCarouselInput, GeneratedCarousel } from "@/types/content.types";

export interface ContentPost {
  id: string;
  type: string;
  title: string | null;
  contentText: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export function useContent(status?: string) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = status ? `?status=${status}` : "";
      const res = await window.fetch(`/api/content${params}`);
      const data = await res.json() as { success: boolean; data: ContentPost[]; error?: { message: string } };
      if (!data.success) throw new Error(data.error?.message ?? "조회 실패");
      setPosts(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { posts, loading, error, refresh: fetch };
}

export function useTextGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: GenerateTextInput): Promise<GeneratedText | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fetch("/api/content/generate/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json() as { success: boolean; data: GeneratedText; error?: { message: string } };
        if (!data.success) throw new Error(data.error?.message ?? "생성 실패");
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { generate, loading, error };
}

export function useCarouselGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      input: GenerateCarouselInput & { generateImages?: boolean }
    ): Promise<GeneratedCarousel | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fetch("/api/content/generate/carousel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json() as {
          success: boolean;
          data: GeneratedCarousel;
          error?: { message: string };
        };
        if (!data.success) throw new Error(data.error?.message ?? "생성 실패");
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { generate, loading, error };
}
