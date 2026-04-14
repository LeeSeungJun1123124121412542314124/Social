// src/components/content/BulkIdeaCard.tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORMS } from "@/lib/constants";
import type { BulkIdeaItem } from "@/types/content.types";

// LLM contentType을 UI에서 지원하는 3개 포맷으로 정규화.
// text/short_form/thread 등 나머지는 모두 text로.
function normalizeFormat(t: string): "text" | "carousel" | "blog" {
  if (t === "carousel") return "carousel";
  if (t === "blog") return "blog";
  return "text";
}

const FORMATS = [
  { key: "text",     label: "텍스트" },
  { key: "carousel", label: "카드뉴스" },
  { key: "blog",     label: "블로그" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  text: "텍스트",
  carousel: "카드뉴스",
  blog: "블로그",
  short_form: "숏폼",
  thread: "쓰레드",
};

type BulkIdeaCardProps = {
  idea: BulkIdeaItem;
  index: number;
  onSubmit: (format: "text" | "carousel" | "blog", editedTopic: string) => void;
};

export function BulkIdeaCard({ idea, index, onSubmit }: BulkIdeaCardProps) {
  const [editing, setEditing] = useState(false);
  // 초기 topic은 LLM 값 사용. 비어있으면 title로 폴백 (서버 sanitize 이후에도 방어).
  const [topic, setTopic] = useState(idea.topic?.trim() || idea.title?.trim() || "");

  const recommended = normalizeFormat(idea.contentType);

  const exitEdit = () => setEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter는 줄바꿈 허용. Enter 단독은 편집 종료.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      exitEdit();
    }
    if (e.key === "Escape") {
      exitEdit();
    }
  };

  const handleFormatClick = (format: "text" | "carousel" | "blog") => {
    // 편집 중이더라도 topic state는 이미 최신 값을 가지고 있음.
    // textarea blur → button click 순서로 React가 처리하므로 topic은 항상 최신.
    const finalTopic = topic.trim() || idea.title?.trim() || "";
    onSubmit(format, finalTopic);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* 상단: 번호 + 제목 */}
        <div className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
            {index + 1}
          </span>
          <p className="font-medium text-sm">{idea.title}</p>
        </div>

        {/* 주제 — 탭하면 인라인 편집 */}
        {editing ? (
          <Textarea
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onBlur={exitEdit}
            onKeyDown={handleKeyDown}
            rows={2}
            className="text-xs resize-none"
          />
        ) : (
          <p
            className="text-xs text-muted-foreground cursor-text hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors line-clamp-2"
            onClick={() => setEditing(true)}
            title="탭하여 편집"
          >
            {topic || <span className="italic opacity-50">주제 없음 — 탭하여 입력</span>}
          </p>
        )}

        {/* 플랫폼 + LLM 추천 타입 뱃지 (참고용) */}
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs">{PLATFORMS[idea.platform]?.name ?? idea.platform}</Badge>
          <Badge variant="secondary" className="text-xs">{TYPE_LABELS[idea.contentType] ?? idea.contentType}</Badge>
        </div>

        {/* 해시태그 */}
        {idea.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {idea.hashtags.slice(0, 3).map((h) => (
              <span key={h} className="text-xs text-muted-foreground">#{h}</span>
            ))}
          </div>
        )}

        {/* 포맷 선택 버튼 */}
        <div className="flex gap-1.5 flex-wrap pt-0.5">
          {FORMATS.map(({ key, label }) => {
            const isRec = key === recommended;
            return (
              <Button
                key={key}
                variant={isRec ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleFormatClick(key)}
              >
                {isRec && <Star className="h-2.5 w-2.5 mr-1 fill-current" />}
                {label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
