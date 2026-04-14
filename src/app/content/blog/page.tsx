// src/app/content/blog/page.tsx
"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Wand2, Copy, Check, Lightbulb, BookOpen, Repeat2 } from "lucide-react";
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
import { useContentHistory, type HistoryPost } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import { consumeHandoff, createRepurposeHandoff } from "@/lib/contentHandoff";

const TIPS = [
  "제목에 핵심 키워드를 포함하면 검색 노출이 높아집니다.",
  "2000자 이상의 글이 SEO에 더 유리합니다.",
  "소제목(##)을 활용해 가독성을 높이세요.",
];

function BlogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // 레거시 URL ?topic= 호환을 위해 초기값은 유지.
  // 신규 핸드오프는 아래 effect에서 덮어씌운다.
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [keywords, setKeywords] = useState("");
  const [targetLength, setTargetLength] = useState("800");
  const [result, setResult] = useState<GeneratedBlog | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const { generate, loading } = useBlogGenerator();

  // 대량기획에서 핸드오프 키로 도착한 경우 topic을 항상 덮어씌운다.
  useEffect(() => {
    const key = searchParams.get("handoff");
    const payload = consumeHandoff(key);
    if (!payload) return;
    setTopic(payload.topic);
    router.replace("/content/blog");
  }, [searchParams, router]);
  const { history, historyLoading, autoSave } = useContentHistory("blog");

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("주제를 입력해주세요."); return; }
    const res = await generate({
      topic,
      keywords: keywords ? keywords.split(",").map((k) => k.trim()) : undefined,
      targetLength: parseInt(targetLength),
    });
    if (res) {
      setResult(res);
      toast.success("블로그가 생성되었습니다.");
      void autoSave({
        title: res.title,
        contentText: res.body,
        contentData: JSON.stringify({ excerpt: res.excerpt, tags: res.tags, wordCount: res.wordCount }),
      });
    }
    else toast.error("생성에 실패했습니다.");
  };

  const handleCopy = () => {
    if (result) {
      void navigator.clipboard.writeText(result.body);
      setCopied(true);
      toast.success("복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendToRepurpose = () => {
    if (!result) return;
    const key = createRepurposeHandoff({
      sourceContent: result.body,
      sourceType: "blog", // blog → blog (리퍼포징 SOURCE_TYPES 동일 이름)
      originType: "blog",
      title: result.title,
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
        ? (JSON.parse(post.contentData) as { excerpt?: string; tags?: string[]; wordCount?: number })
        : {};
      setResult({
        title: post.title ?? "",
        body: post.contentText ?? "",
        excerpt: meta.excerpt ?? "",
        tags: meta.tags ?? [],
        wordCount: meta.wordCount ?? (post.contentText?.split(/\s+/).length ?? 0),
      });
      toast.success("이전 결과를 복원했습니다.");
    } catch {
      toast.error("복원에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">블로그 아티클 생성</h1>
        <p className="text-muted-foreground mt-1">병원 블로그용 장문 아티클을 AI로 작성합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6 items-start">
        {/* 좌측: 입력 폼 */}
        <div className="space-y-4 lg:sticky lg:top-6">
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
          {!result && !loading && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">주제를 입력하고 생성 버튼을 누르세요</p>
            </div>
          )}

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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary">{result.wordCount.toLocaleString()}자</Badge>
                    <Badge variant="outline">{Math.ceil(result.wordCount / 300)}분 읽기</Badge>
                  </div>
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

export default function BlogPage() {
  return (
    <Suspense>
      <BlogContent />
    </Suspense>
  );
}
