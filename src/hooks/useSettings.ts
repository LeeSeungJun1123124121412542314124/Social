"use client";

import { useState, useEffect, useCallback } from "react";
import type { AISettingsDTO, UpdateAISettingsInput } from "@/services/settings.service";

export function useAISettings() {
  const [settings, setSettings] = useState<AISettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/ai");
      const data = await res.json() as { success: boolean; data: AISettingsDTO };
      if (data.success) setSettings(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (input: UpdateAISettingsInput): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json() as { success: boolean; data: AISettingsDTO };
      if (data.success) {
        setSettings(data.data);
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const testConnection = useCallback(async (
    provider: "openai" | "anthropic" | "flux" | "dalle"
  ): Promise<{ success: boolean; message: string; latencyMs?: number }> => {
    setTesting(provider);
    try {
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json() as { success: boolean; data: { success: boolean; message: string; latencyMs?: number } };
      return data.success ? data.data : { success: false, message: "요청 실패" };
    } finally {
      setTesting(null);
    }
  }, []);

  return { settings, loading, saving, testing, save, testConnection, refresh };
}
