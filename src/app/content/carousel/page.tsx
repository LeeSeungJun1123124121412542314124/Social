// src/app/content/carousel/page.tsx
"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Wand2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { CarouselSlideCard } from "@/components/content/CarouselSlideCard";
import { CarouselPreview } from "@/components/content/CarouselPreview";
import { useRouter } from "next/navigation";
import { useCarouselGenerator } from "@/hooks/useContent";
import { useAISettings } from "@/hooks/useSettings";
import type { CarouselSlide, GeneratedCarousel } from "@/types/content.types";
import { useContentHistory } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import type { HistoryPost } from "@/hooks/useContentHistory";

// 스타일 옵션 — 렌더링마다 재생성 방지를 위해 컴포넌트 외부에 정의
const STYLES = [
  { value: "minimal", label: "미니멀" },
  { value: "vivid", label: "생동감있는" },
  { value: "professional", label: "전문적인" },
  { value: "warm", label: "따뜻한" },
];

function CarouselContent() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [slideCount, setSlideCount] = useState("5");
  const [style, setStyle] = useState("minimal");
  const [generateImages, setGenerateImages] = useState(false);
  const [result, setResult] = useState<GeneratedCarousel | null>(null);
  const [activeTab, setActiveTab] = useState("generate");

  const { generate, loading, error } = useCarouselGenerator();
  const { history, historyLoading, autoSave } = useContentHistory("carousel");
  const { settings: aiSettings } = useAISettings();
  const [imageProvider, setImageProvider] = useState<"pollinations" | "dalle" | "flux">("pollinations");
  const router = useRouter();

  // 설정에서 불러온 imageProvider를 기본값으로 설정
  useEffect(() => {
    if (aiSettings?.imageProvider) {
      setImageProvider(aiSettings.imageProvider as "pollinations" | "dalle" | "flux");
    }
  }, [aiSettings?.imageProvider]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("주제를 입력해주세요.");
      return;
    }
    const res = await generate({
      topic,
      slideCount: parseInt(slideCount),
      style,
      generateImages,
      imageProvider: generateImages ? imageProvider : undefined,
    });
    if (res) {
      setResult(res);
      setActiveTab("edit");
      toast.success("카드뉴스가 생성되었습니다.");
      void autoSave({
        title: topic.substring(0, 50),
        contentText: res.caption,
        contentData: JSON.stringify({ slides: res.slides }),
      });
    } else {
      const msg = error ?? "생성에 실패했습니다.";
      if (msg.includes("/settings")) {
        toast.error(msg, {
          action: { label: "설정으로 이동", onClick: () => router.push("/settings") },
          duration: 6000,
        });
      } else {
        toast.error(msg);
      }
    }
  };

  const handleSlideChange = (index: number, updated: CarouselSlide) => {
    if (!result) return;
    const slides = [...result.slides];
    slides[index] = updated;
    setResult({ ...result, slides });
  };

  const handleRestore = (post: HistoryPost) => {
    try {
      const meta = post.contentData
        ? (JSON.parse(post.contentData) as { slides?: CarouselSlide[] })
        : {};
      setResult({
        caption: post.contentText ?? "",
        slides: meta.slides ?? [],
      });
      setActiveTab("edit");
      toast.success("이전 결과를 복원했습니다.");
    } catch {
      toast.error("복원에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">카드뉴스 랩</h1>
        <p className="text-muted-foreground mt-1">
          AI로 카드뉴스 슬라이드를 자동 생성합니다.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-full bg-muted p-1">
          <TabsTrigger value="generate">생성</TabsTrigger>
          <TabsTrigger value="edit" disabled={!result}>편집</TabsTrigger>
          <TabsTrigger value="preview" disabled={!result}>미리보기</TabsTrigger>
        </TabsList>

        {/* 생성 탭 */}
        <TabsContent value="generate" className="max-w-lg space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="topic">주제</Label>
            <Textarea
              id="topic"
              placeholder="예: 봄 피부 관리 5가지 방법, 건강검진 준비사항..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>슬라이드 수</Label>
              <Select value={slideCount} onValueChange={(v) => v && setSlideCount(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}장</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>스타일</Label>
              <Select value={style} onValueChange={(v) => v && setStyle(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">AI 이미지 생성</p>
                <p className="text-xs text-muted-foreground">
                  슬라이드마다 이미지를 자동 생성합니다
                </p>
              </div>
              <Switch
                checked={generateImages}
                onCheckedChange={setGenerateImages}
              />
            </div>
            {generateImages && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground w-16 shrink-0">프로바이더</span>
                <Select value={imageProvider} onValueChange={(v) => setImageProvider(v as typeof imageProvider)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pollinations">Pollinations (무료)</SelectItem>
                    <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                    <SelectItem value="flux">Flux (fal.ai)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="w-full"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {loading ? "생성 중..." : "카드뉴스 생성"}
          </Button>
        </TabsContent>

        {/* 편집 탭 */}
        <TabsContent value="edit" className="mt-4">
          {result && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.slides.map((slide, i) => (
                  <div key={slide.order} className="relative">
                    <span className="absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                      {i + 1}
                    </span>
                    <CarouselSlideCard
                      slide={slide}
                      index={i}
                      onChange={(updated) => handleSlideChange(i, updated)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>캡션</Label>
                <Textarea
                  value={result.caption}
                  onChange={(e) => setResult({ ...result, caption: e.target.value })}
                  rows={4}
                />
              </div>

            </div>
          )}
        </TabsContent>

        {/* 미리보기 탭 */}
        <TabsContent value="preview" className="mt-4">
          {result && (
            <CarouselPreview slides={result.slides} caption={result.caption} />
          )}
        </TabsContent>
      </Tabs>
      <ContentHistoryPanel
        history={history}
        loading={historyLoading}
        onRestore={handleRestore}
      />
    </div>
  );
}

export default function CarouselPage() {
  return (
    <Suspense>
      <CarouselContent />
    </Suspense>
  );
}
