// src/app/content/carousel/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wand2, Save, ImageIcon } from "lucide-react";
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
import type { CarouselSlide, GeneratedCarousel } from "@/types/content.types";

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
  const router = useRouter();

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
    });
    if (res) {
      setResult(res);
      setActiveTab("edit");
      toast.success("카드뉴스가 생성되었습니다.");
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

  const handleSave = async () => {
    if (!result) return;
    try {
      const res = await window.fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "carousel",
          title: topic.substring(0, 50),
          contentText: result.caption,
          contentData: JSON.stringify(result.slides),
          mediaUrls: result.slides
            .filter((s) => s.imageUrl)
            .map((s) => s.imageUrl as string),
        }),
      });
      if (!res.ok) throw new Error(`저장 요청 실패: ${res.status}`);
      const data = await res.json() as { success: boolean; error?: { message: string } };
      if (data.success) {
        toast.success("카드뉴스가 저장되었습니다.");
      } else {
        toast.error(data.error?.message ?? "저장에 실패했습니다.");
      }
    } catch {
      toast.error("저장에 실패했습니다.");
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

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">AI 이미지 생성</p>
              <p className="text-xs text-muted-foreground">
                DALL-E/FLUX로 각 슬라이드 이미지를 생성합니다 (시간이 걸립니다)
              </p>
            </div>
            <Switch
              checked={generateImages}
              onCheckedChange={setGenerateImages}
            />
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

              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                임시저장
              </Button>
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
