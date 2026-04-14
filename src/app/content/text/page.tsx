"use client";

import { Suspense, useState, useEffect } from "react";
import { Wand2, Copy, Check, Lightbulb, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTextGenerator } from "@/hooks/useContent";
import { useAccounts } from "@/hooks/useAccounts";
import { PLATFORMS, PLATFORM_TYPES } from "@/lib/constants";
import type { PlatformType } from "@/types/platform.types";
import type { GeneratedText } from "@/types/content.types";
import { useContentHistory, type HistoryPost } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import { useSearchParams, useRouter } from "next/navigation";
import { consumeHandoff, createRepurposeHandoff } from "@/lib/contentHandoff";

const TIPS = [
  "첫 문장에 핵심을 담아 독자의 주의를 잡으세요.",
  "이모지를 적절히 활용하면 가독성이 높아집니다.",
  "해시태그는 3~5개가 최적입니다.",
];

function TextContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<PlatformType>("instagram");
  const [tone, setTone] = useState("professional_friendly");
  const [result, setResult] = useState<GeneratedText | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const { generate, loading: generating } = useTextGenerator();
  const { accounts } = useAccounts();
  const { history, historyLoading, autoSave } = useContentHistory("text");

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  // 대량기획에서 핸드오프 키로 도착한 경우 topic/platform을 항상 덮어씌운다.
  useEffect(() => {
    const key = searchParams.get("handoff");
    const payload = consumeHandoff(key);
    if (!payload) return;
    setTopic(payload.topic);
    if (payload.platform) setPlatform(payload.platform);
    // tone은 LLM suggestedTone이 자유 서술이라 Select 옵션과 다를 수 있어 덮어쓰지 않음
    router.replace("/content/text");
  }, [searchParams, router]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("주제를 입력해주세요.");
      return;
    }
    const generated = await generate({ topic, platform, tone });
    if (generated) {
      setResult(generated);
      void autoSave({
        title: topic.substring(0, 50),
        contentText: generated.text,
        contentData: JSON.stringify({
          platform: generated.platform,
          hashtags: generated.hashtags,
        }),
      });
      toast.success("콘텐츠가 생성되었습니다.");
    } else {
      toast.error("생성에 실패했습니다. API 키를 확인하세요.");
    }
  };

  const handleCopy = () => {
    if (result) {
      void navigator.clipboard.writeText(result.text);
      setCopied(true);
      toast.success("클립보드에 복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendToRepurpose = () => {
    if (!result) return;
    const key = createRepurposeHandoff({
      sourceContent: result.text,
      sourceType: "idea", // text → idea (리퍼포징 SOURCE_TYPES 매핑)
      originType: "text",
      title: topic.substring(0, 50),
    });
    if (!key) {
      toast.error("리퍼포징 페이지로 전달 실패");
      return;
    }
    router.push(`/content/repurpose?handoff=${key}`);
  };

  const handleRestore = (post: HistoryPost) => {
    try {
      const meta = post.contentData
        ? (JSON.parse(post.contentData) as { platform?: string; hashtags?: string[] })
        : {};
      setResult({
        text: post.contentText ?? "",
        platform: (meta.platform ?? platform) as PlatformType,
        characterCount: post.contentText?.length ?? 0,
        hashtags: meta.hashtags,
      });
      toast.success("이전 결과를 복원했습니다.");
    } catch {
      toast.error("복원에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">텍스트 콘텐츠 생성</h1>
        <p className="text-muted-foreground mt-1">
          주제를 입력하면 AI가 플랫폼에 최적화된 게시물을 작성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6 items-start">
        {/* 좌측: 입력 폼 */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="space-y-2">
            <Label htmlFor="topic">주제</Label>
            <Textarea
              id="topic"
              placeholder="예: 봄맞이 피부 관리 방법, 건강검진 예약 안내..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>플랫폼</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_TYPES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    platform === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {PLATFORMS[p].name}
                  {connectedPlatforms.has(p) && (
                    <span className="ml-1 text-xs opacity-70">✓</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              최대 글자 수: {PLATFORMS[platform].maxTextLength.toLocaleString()}자
            </p>
          </div>

          <div className="space-y-2">
            <Label>톤</Label>
            <Select value={tone} onValueChange={(v) => v && setTone(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional_friendly">전문적이면서 친근한</SelectItem>
                <SelectItem value="formal">격식체</SelectItem>
                <SelectItem value="casual">캐주얼</SelectItem>
                <SelectItem value="warm">따뜻하고 공감하는</SelectItem>
                <SelectItem value="informative">정보 전달 위주</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="w-full"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {generating ? "생성 중..." : "AI 콘텐츠 생성"}
          </Button>

          {/* 작성 팁 */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <button
              onClick={() => setShowTips((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              작성 팁
              <span className="ml-auto">{showTips ? "▲" : "▼"}</span>
            </button>
            {showTips && (
              <ul className="px-3 pb-3 space-y-1.5">
                {TIPS.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 우측: 결과 영역 */}
        <div>
          {!result && !generating && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center py-16 text-center">
              <Wand2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">주제를 입력하고 생성 버튼을 누르세요</p>
            </div>
          )}

          {generating && (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          )}

          {result && !generating && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">생성된 콘텐츠</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">{result.characterCount}자</Badge>
                    <Badge
                      variant={
                        result.characterCount > PLATFORMS[platform].maxTextLength
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {PLATFORMS[platform].name}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={result.text}
                  onChange={(e) =>
                    setResult((prev) =>
                      prev
                        ? { ...prev, text: e.target.value, characterCount: e.target.value.length }
                        : null
                    )
                  }
                  rows={10}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {copied ? "복사됨" : "복사"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSendToRepurpose}>
                    <Repeat2 className="h-3.5 w-3.5 mr-1.5" />
                    리퍼포징
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ContentHistoryPanel
        history={history}
        loading={historyLoading}
        onRestore={handleRestore}
      />
    </div>
  );
}

export default function TextContentPage() {
  return (
    <Suspense>
      <TextContent />
    </Suspense>
  );
}
