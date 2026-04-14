// src/app/content/repurpose/page.tsx
"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RefreshCw, Copy, Check, Repeat2, Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRepurposeGenerator } from "@/hooks/useContent";
import { PLATFORMS, PLATFORM_TYPES } from "@/lib/constants";
import type { ContentType, RepurposeResult } from "@/types/content.types";
import type { PlatformType } from "@/types/platform.types";
import { useContentHistory, type HistoryPost } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import { consumeRepurposeHandoff } from "@/lib/contentHandoff";
import { HistorySearchDialog, type SearchableType } from "@/components/content/HistorySearchDialog";

const SOURCE_TYPES = [
  { value: "blog", label: "블로그 아티클" },
  { value: "video", label: "영상 스크립트" },
  { value: "idea", label: "아이디어/메모" },
  { value: "script", label: "강의/발표 스크립트" },
] as const;

type SourceType = (typeof SOURCE_TYPES)[number]["value"];

const TARGET_FORMATS: { value: ContentType; label: string }[] = [
  { value: "text", label: "SNS 텍스트" },
  { value: "carousel", label: "카드뉴스 구성" },
  { value: "short_form", label: "숏폼 스크립트" },
  { value: "thread", label: "쓰레드" },
];

function RepurposeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>("blog");
  const [sourceContent, setSourceContent] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<ContentType[]>(["text"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(["instagram"]);
  const [results, setResults] = useState<RepurposeResult[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const { repurpose, loading } = useRepurposeGenerator();
  const { history, historyLoading, autoSave } = useContentHistory("repurpose");

  // 텍스트/블로그/카드뉴스 페이지에서 핸드오프 키로 도착한 경우 sourceContent를 채운다
  useEffect(() => {
    const key = searchParams.get("handoff");
    const payload = consumeRepurposeHandoff(key);
    if (!payload) return;
    setSourceContent(payload.sourceContent);
    setSourceType(payload.sourceType);
    toast.success("이전 결과를 불러왔습니다.");
    router.replace("/content/repurpose");
  }, [searchParams, router]);

  const toggleFormat = (f: ContentType) =>
    setSelectedFormats((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const togglePlatform = (p: PlatformType) =>
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const handleRepurpose = async () => {
    if (!sourceContent.trim()) { toast.error("원본 콘텐츠를 입력해주세요."); return; }
    if (selectedFormats.length === 0) { toast.error("변환 형식을 선택해주세요."); return; }

    const res = await repurpose({
      sourceType,
      sourceContent,
      targetFormats: selectedFormats,
      targetPlatforms: selectedPlatforms,
    });
    if (res) {
      setResults(res);
      toast.success(`${res.length}개 형식으로 변환되었습니다.`);
      void autoSave({
        title: sourceContent.substring(0, 50),
        contentData: JSON.stringify(res),
      });
    }
    else toast.error("변환에 실패했습니다.");
  };

  const handleCopy = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("복사됨");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRestore = (post: HistoryPost) => {
    try {
      const restored = JSON.parse(post.contentData ?? "[]") as RepurposeResult[];
      if (!Array.isArray(restored)) throw new Error("잘못된 데이터");
      setResults(restored);
      toast.success("이전 결과를 복원했습니다.");
    } catch {
      toast.error("복원에 실패했습니다.");
    }
  };

  // 히스토리 검색 모달에서 항목 선택 시 sourceContent에 채우기
  const handleSelectFromHistory = (post: HistoryPost, originType: SearchableType) => {
    let content = post.contentText ?? "";

    // carousel은 contentText(caption)만으로 맥락이 부족 → slides 본문을 합쳐준다
    if (originType === "carousel" && post.contentData) {
      try {
        const parsed = JSON.parse(post.contentData) as {
          slides?: { body?: string }[];
        };
        const slideBodies = (parsed.slides ?? [])
          .map((s) => s.body ?? "")
          .filter(Boolean)
          .join("\n\n");
        content = [content, slideBodies].filter(Boolean).join("\n\n");
      } catch {
        // 파싱 실패 시 contentText 그대로 사용
      }
    }

    setSourceContent(content);
    // text/carousel → idea, blog → blog (리퍼포징 SOURCE_TYPES 매핑)
    setSourceType(originType === "blog" ? "blog" : "idea");
    setSearchOpen(false);
    toast.success("원본 콘텐츠를 불러왔습니다.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">콘텐츠 리퍼포징</h1>
        <p className="text-muted-foreground mt-1">기존 콘텐츠를 다양한 형식으로 재활용합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6 items-start">
        {/* 좌측: 입력 폼 */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {/* DB 히스토리에서 원본 불러오기 */}
          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            className="w-full justify-start"
          >
            <Database className="h-4 w-4 mr-2" />
            DB에서 불러오기
          </Button>

          <div className="space-y-2">
            <Label>원본 유형</Label>
            <Select value={sourceType} onValueChange={(v) => v && setSourceType(v as typeof sourceType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>원본 콘텐츠</Label>
            <Textarea
              placeholder="변환할 원본 텍스트를 붙여넣으세요..."
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              rows={8}
            />
            <p className="text-xs text-muted-foreground">{sourceContent.length.toLocaleString()}자</p>
          </div>

          <div className="space-y-2">
            <Label>변환 형식</Label>
            <div className="flex flex-wrap gap-2">
              {TARGET_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => toggleFormat(f.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedFormats.includes(f.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>대상 플랫폼</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_TYPES.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedPlatforms.includes(p)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {PLATFORMS[p].name}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleRepurpose} disabled={loading || !sourceContent.trim()} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            {loading ? "변환 중..." : "리퍼포징 시작"}
          </Button>
        </div>

        {/* 우측: 결과 영역 */}
        <div>
          {results.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center py-16 text-center">
              <Repeat2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">원본 콘텐츠를 입력하고 변환을 시작하세요</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid gap-4">
              {results.map((result, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {result.title ?? TARGET_FORMATS.find((f) => f.value === result.format)?.label}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        {result.platform && (
                          <Badge variant="outline" className="text-xs">
                            {PLATFORMS[result.platform]?.name ?? result.platform}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea value={result.text} readOnly rows={6} className="text-sm" />
                    {result.hashtags && result.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {result.hashtags.map((h) => (
                          <span key={h} className="text-xs text-muted-foreground">#{h}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopy(result.text, i)}>
                        {copiedIndex === i ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {copiedIndex === i ? "복사됨" : "복사"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <ContentHistoryPanel
        history={history}
        loading={historyLoading}
        onRestore={handleRestore}
      />

      <HistorySearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleSelectFromHistory}
      />
    </div>
  );
}

export default function RepurposePage() {
  return (
    <Suspense>
      <RepurposeContent />
    </Suspense>
  );
}
