// src/app/content/bulk/page.tsx
"use client";

import { useState } from "react";
import { Wand2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBulkGenerator } from "@/hooks/useContent";
import { PLATFORMS, PLATFORM_TYPES } from "@/lib/constants";
import type { BulkPlan, BulkIdeaItem } from "@/types/content.types";
import type { PlatformType } from "@/types/platform.types";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<string, string> = {
  text: "텍스트", carousel: "카드뉴스", blog: "블로그",
};

export default function BulkPage() {
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState("10");
  const [period, setPeriod] = useState("2주치");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(["instagram"]);
  const [result, setResult] = useState<BulkPlan | null>(null);
  const { generate, loading } = useBulkGenerator();
  const router = useRouter();

  const togglePlatform = (p: PlatformType) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = async () => {
    if (!theme.trim()) { toast.error("테마를 입력해주세요."); return; }
    if (selectedPlatforms.length === 0) { toast.error("플랫폼을 선택해주세요."); return; }
    const res = await generate({ theme, count: parseInt(count), platforms: selectedPlatforms, period });
    if (res) { setResult(res); toast.success(`${res.ideas.length}개 아이디어가 생성되었습니다.`); }
    else toast.error("생성에 실패했습니다.");
  };

  const handleUseIdea = (idea: BulkIdeaItem) => {
    const params = new URLSearchParams({ topic: idea.topic, platform: idea.platform });
    if (idea.contentType === "blog") router.push(`/content/blog?${params.toString()}`);
    else if (idea.contentType === "carousel") router.push(`/content/carousel?${params.toString()}`);
    else router.push(`/content/text?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대량 콘텐츠 기획</h1>
        <p className="text-muted-foreground mt-1">테마를 입력하면 SNS 콘텐츠 아이디어를 한번에 기획합니다.</p>
      </div>

      <div className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label>테마</Label>
          <Input placeholder="예: 여름 건강 관리, 건강검진 시즌..." value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>아이디어 수</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>기간</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2주치" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>플랫폼</Label>
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
        <Button onClick={handleGenerate} disabled={loading || !theme.trim()} className="w-full">
          <Wand2 className="h-4 w-4 mr-2" />
          {loading ? "기획 중..." : "콘텐츠 기획 시작"}
        </Button>
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <h2 className="font-semibold">{result.theme} — {result.ideas.length}개 아이디어</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.ideas.map((idea, i) => (
              <Card key={i} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleUseIdea(idea)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{idea.title}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{idea.topic}</p>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-xs">{PLATFORMS[idea.platform]?.name}</Badge>
                    <Badge variant="secondary" className="text-xs">{TYPE_LABELS[idea.contentType] ?? idea.contentType}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {idea.hashtags.slice(0, 3).map((h) => (
                      <span key={h} className="text-xs text-muted-foreground">#{h}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
