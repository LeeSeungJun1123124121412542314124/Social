"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAISettings } from "@/hooks/useSettings";
import type { UpdateAISettingsInput } from "@/services/settings.service";

function KeyStatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <Badge variant="outline" className="gap-1 text-green-600 border-green-300 dark:border-green-800">
      <CheckCircle2 className="h-3 w-3" />
      설정됨
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <XCircle className="h-3 w-3" />
      미설정
    </Badge>
  );
}

function KeyInput({
  id,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-9"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, loading, saving, testing, save, testConnection, refresh } = useAISettings();

  // 폼 상태 (입력값이 있을 때만 저장, 빈 문자열이면 삭제)
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [imageProvider, setImageProvider] = useState<"flux" | "dalle" | "pollinations">("pollinations");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [falKey, setFalKey] = useState("");

  // settings 최초 로드 시 provider 초기화 (이후 사용자 선택 유지)
  useEffect(() => {
    if (!settings) return;
    setLlmProvider(settings.llmProvider);
    setImageProvider(settings.imageProvider as "flux" | "dalle" | "pollinations");
  }, [settings?.llmProvider, settings?.imageProvider]);

  const handleSave = async () => {
    const input: UpdateAISettingsInput = {
      llmProvider,
      imageProvider,
    };
    // 입력값이 있을 때만 포함 (undefined = 변경없음)
    if (openaiKey !== "") input.openaiApiKey = openaiKey;
    if (anthropicKey !== "") input.anthropicApiKey = anthropicKey;
    if (falKey !== "") input.falApiKey = falKey;

    const ok = await save(input);
    if (ok) {
      toast.success("설정이 저장되었습니다.");
      setOpenaiKey("");
      setAnthropicKey("");
      setFalKey("");
    } else {
      toast.error("저장에 실패했습니다.");
    }
  };

  const handleTest = async (provider: "openai" | "anthropic" | "flux" | "dalle") => {
    // 저장 전이라도 입력값이 있으면 직접 전달해서 테스트
    const keyOverride =
      provider === "openai" || provider === "dalle" ? openaiKey || undefined
      : provider === "anthropic" ? anthropicKey || undefined
      : provider === "flux" ? falKey || undefined
      : undefined;
    const result = await testConnection(provider, keyOverride);
    if (result.success) {
      toast.success(`${result.message}${result.latencyMs != null ? ` (${result.latencyMs}ms)` : ""}`);
    } else {
      toast.error(result.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dalleUsesOpenaiKey = imageProvider === "dalle";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-muted-foreground mt-1">AI 연동 및 서비스 설정을 관리합니다.</p>
      </div>

      {/* LLM Provider */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">텍스트 생성 AI</h2>
          <KeyStatusBadge
            configured={llmProvider === "openai" ? (settings?.openaiKeyConfigured ?? false) : (settings?.anthropicKeyConfigured ?? false)}
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="llm-provider">Provider</Label>
            <Select
              value={llmProvider}
              onValueChange={(v) => setLlmProvider(v as "openai" | "anthropic")}
            >
              <SelectTrigger id="llm-provider" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {llmProvider === "openai" && (
            <div className="space-y-1.5">
              <Label htmlFor="openai-key">
                OpenAI API Key
                {settings?.openaiKeyConfigured && (
                  <span className="ml-2 text-xs text-muted-foreground">새 값 입력 시 덮어씁니다</span>
                )}
              </Label>
              <div className="flex gap-2">
                <KeyInput
                  id="openai-key"
                  placeholder={settings?.openaiKeyConfigured ? "sk-••••••••••••••••" : "sk-..."}
                  value={openaiKey}
                  onChange={setOpenaiKey}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest("openai")}
                  disabled={testing === "openai" || (!settings?.openaiKeyConfigured && !openaiKey)}
                >
                  {testing === "openai" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  테스트
                </Button>
              </div>
            </div>
          )}

          {llmProvider === "anthropic" && (
            <div className="space-y-1.5">
              <Label htmlFor="anthropic-key">
                Anthropic API Key
                {settings?.anthropicKeyConfigured && (
                  <span className="ml-2 text-xs text-muted-foreground">새 값 입력 시 덮어씁니다</span>
                )}
              </Label>
              <div className="flex gap-2">
                <KeyInput
                  id="anthropic-key"
                  placeholder={settings?.anthropicKeyConfigured ? "sk-ant-••••••••••••" : "sk-ant-..."}
                  value={anthropicKey}
                  onChange={setAnthropicKey}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest("anthropic")}
                  disabled={testing === "anthropic" || (!settings?.anthropicKeyConfigured && !anthropicKey)}
                >
                  {testing === "anthropic" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  테스트
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Image Provider */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">이미지 생성 AI</h2>
          <KeyStatusBadge
            configured={
              imageProvider === "pollinations"
                ? true
                : imageProvider === "dalle"
                  ? (settings?.openaiKeyConfigured ?? false)
                  : (settings?.falKeyConfigured ?? false)
            }
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="image-provider">Provider</Label>
            <Select
              value={imageProvider}
              onValueChange={(v) => setImageProvider(v as "flux" | "dalle" | "pollinations")}
            >
              <SelectTrigger id="image-provider" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pollinations">Pollinations (무료)</SelectItem>
                <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                <SelectItem value="flux">Flux (fal.ai)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {imageProvider === "pollinations" ? (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              API 키 불필요 — 무료로 바로 사용 가능합니다. 요청 간격 제한이 있어 슬라이드 수가 많으면 다소 느릴 수 있습니다.
            </div>
          ) : dalleUsesOpenaiKey ? (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              DALL-E는 OpenAI API 키를 공유합니다. 위 텍스트 생성 AI에서 OpenAI 키를 설정하면 함께 사용됩니다.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="fal-key">
                FAL API Key
                {settings?.falKeyConfigured && (
                  <span className="ml-2 text-xs text-muted-foreground">새 값 입력 시 덮어씁니다</span>
                )}
              </Label>
              <div className="flex gap-2">
                <KeyInput
                  id="fal-key"
                  placeholder={settings?.falKeyConfigured ? "••••:••••••••••••••••••••" : "key:secret"}
                  value={falKey}
                  onChange={setFalKey}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest("flux")}
                  disabled={testing === "flux" || (!settings?.falKeyConfigured && !falKey)}
                >
                  {testing === "flux" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  테스트
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                fal.ai 키 형식: <code className="bg-muted px-1 rounded">key:secret</code>
                &nbsp;—&nbsp;
                <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="underline">
                  fal.ai 대시보드
                </a>
                에서 발급
              </p>
            </div>
          )}
        </div>
      </section>

      <Separator />

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        저장
      </Button>
    </div>
  );
}
