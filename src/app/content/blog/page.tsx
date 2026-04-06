// src/app/content/blog/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wand2, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlogGenerator } from "@/hooks/useContent";
import type { GeneratedBlog } from "@/types/content.types";

export default function BlogPage() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [keywords, setKeywords] = useState("");
  const [targetLength, setTargetLength] = useState("800");
  const [result, setResult] = useState<GeneratedBlog | null>(null);

  const { generate, loading } = useBlogGenerator();

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("주제를 입력해주세요."); return; }
    const res = await generate({
      topic,
      keywords: keywords ? keywords.split(",").map((k) => k.trim()) : undefined,
      targetLength: parseInt(targetLength),
    });
    if (res) { setResult(res); toast.success("블로그가 생성되었습니다."); }
    else toast.error("생성에 실패했습니다.");
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      const res = await window.fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blog",
          title: result.title,
          contentText: result.body,
          contentData: JSON.stringify({ excerpt: result.excerpt, tags: result.tags }),
        }),
      });
      if (!res.ok) throw new Error(`저장 요청 실패: ${res.status}`);
      const data = await res.json() as { success: boolean; error?: { message: string } };
      if (data.success) {
        toast.success("블로그가 저장되었습니다.");
      } else {
        toast.error(data.error?.message ?? "저장에 실패했습니다.");
      }
    } catch { toast.error("저장에 실패했습니다."); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">블로그 아티클 생성</h1>
        <p className="text-muted-foreground mt-1">병원 블로그용 장문 아티클을 AI로 작성합니다.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>주제</Label>
          <Textarea
            placeholder="예: 고혈압 환자의 식이요법, 건강검진 결과 해석 방법..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>포함 키워드 (쉼표 구분)</Label>
            <Input
              placeholder="혈압, 식단, 운동..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>목표 분량</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={targetLength}
              onChange={(e) => setTargetLength(e.target.value)}
            >
              <option value="500">500자</option>
              <option value="800">800자</option>
              <option value="1200">1200자</option>
              <option value="2000">2000자</option>
            </select>
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={loading || !topic.trim()} className="w-full">
          <Wand2 className="h-4 w-4 mr-2" />
          {loading ? "생성 중..." : "블로그 생성"}
        </Button>
      </div>

      {loading && (
        <Card>
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">{result.title}</CardTitle>
              <Badge variant="secondary">{result.wordCount.toLocaleString()}자</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{result.excerpt}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {result.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={result.body}
              onChange={(e) => setResult({ ...result, body: e.target.value, wordCount: e.target.value.length })}
              rows={16}
              className="text-sm font-mono"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(result.body); toast.success("복사됨"); }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />복사
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1.5" />저장
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
