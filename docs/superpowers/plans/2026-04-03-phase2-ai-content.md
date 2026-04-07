# Phase 2: AI 콘텐츠 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 이미지 기반 카드뉴스 생성, 블로그/대량기획/리퍼포징 텍스트 AI, TikTok·YouTube·X 플랫폼 어댑터 완성

**Architecture:** 기존 `LLMProvider` 패턴과 동일하게 `ImageProvider` 인터페이스를 구현하는 DALL-E/FLUX provider를 추가하고, `CarouselGenerator`/`BlogGenerator`/`BulkGenerator`/`RepurposeGenerator`가 이를 주입받아 동작한다. 생성된 이미지는 `public/uploads/` 로컬 디렉터리에 저장한다. X/TikTok은 PKCE OAuth 2.0을 사용하므로 code_verifier를 httpOnly 쿠키로 임시 저장한다.

**Tech Stack:** Next.js App Router, OpenAI SDK (images.generate), @fal-ai/client (FLUX), node-fetch 내장, TikTok Content Posting API v2, YouTube Data API v3, Twitter API v2

---

## 파일 구조 (변경/신규)

```
src/
├── ai/
│   ├── image/
│   │   ├── image.provider.ts       (기존 인터페이스 — 변경 없음)
│   │   ├── dalle.provider.ts       ← 신규
│   │   └── flux.provider.ts        ← 신규
│   ├── generators/
│   │   ├── text.generator.ts       (기존 — 변경 없음)
│   │   ├── carousel.generator.ts   ← 신규
│   │   ├── blog.generator.ts       ← 신규
│   │   ├── bulk.generator.ts       ← 신규
│   │   └── repurpose.generator.ts  ← 신규
│   └── index.ts                    ← 수정 (getImageProvider, getCarouselGenerator 추가)
├── lib/
│   └── file-upload.ts              ← 신규 (원격 이미지 → 로컬 저장)
├── types/
│   └── content.types.ts            ← 수정 (BulkIdeaItem, BulkPlan, CarouselSlide.imageUrl 옵셔널화)
├── adapters/
│   ├── tiktok.adapter.ts           ← 전면 교체
│   ├── youtube.adapter.ts          ← 전면 교체
│   └── x.adapter.ts                ← 전면 교체
├── app/
│   └── api/
│       ├── accounts/
│       │   ├── auth/[platform]/route.ts    ← 수정 (PKCE code_verifier 쿠키)
│       │   └── callback/[platform]/route.ts ← 수정 (code_verifier 쿠키 읽기)
│       └── content/generate/
│           ├── carousel/route.ts   ← 신규
│           ├── blog/route.ts       ← 신규
│           ├── bulk/route.ts       ← 신규
│           └── repurpose/route.ts  ← 신규
├── app/content/
│   ├── carousel/page.tsx           ← 전면 교체
│   ├── blog/page.tsx               ← 전면 교체
│   ├── bulk/page.tsx               ← 전면 교체
│   └── repurpose/page.tsx          ← 전면 교체
├── components/content/
│   ├── CarouselSlideCard.tsx       ← 신규
│   └── CarouselPreview.tsx         ← 신규
└── hooks/
    └── useContent.ts               ← 수정 (useCarouselGenerator, useBlogGenerator 등 추가)
```

---

## 서브시스템 A: 카드뉴스 랩

### Task A1: content.types.ts — CarouselSlide imageUrl 옵셔널화 + BulkPlan 타입 추가

**Files:**
- Modify: `src/types/content.types.ts`

- [ ] **Step 1: content.types.ts 수정**

```typescript
// src/types/content.types.ts 전체 교체 내용 (변경 부분만 표시)

// 기존 CarouselSlide의 imageUrl을 옵셔널로 변경
export interface CarouselSlide {
  imageUrl?: string;   // 이미지 미생성 시 undefined
  text?: string;
  order: number;
}

// BulkPlan 타입 추가 (Task B2에서 사용)
export interface BulkIdeaItem {
  title: string;
  topic: string;
  platform: PlatformType;
  contentType: ContentType;
  suggestedTone: string;
  hashtags: string[];
}

export interface BulkPlan {
  theme: string;
  ideas: BulkIdeaItem[];
}

// RepurposeResult 타입 추가 (Task B3에서 사용)
export interface RepurposeResult {
  format: ContentType;
  platform?: PlatformType;
  title?: string;
  text: string;
  hashtags?: string[];
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add src/types/content.types.ts
git commit -m "feat: Phase2 타입 확장 (CarouselSlide imageUrl 옵셔널, BulkPlan, RepurposeResult)"
```

---

### Task A2: lib/file-upload.ts — 원격 이미지 로컬 저장

**Files:**
- Create: `src/lib/file-upload.ts`
- Create: `public/uploads/.gitkeep`

- [ ] **Step 1: public/uploads 디렉터리 생성**

```bash
mkdir -p d:/Dev/social/public/uploads/carousel
touch d:/Dev/social/public/uploads/.gitkeep
```

- [ ] **Step 2: file-upload.ts 작성**

```typescript
// src/lib/file-upload.ts
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * 원격 URL의 이미지를 다운로드하여 public/uploads/{folder}/ 에 저장
 * @returns 브라우저에서 접근 가능한 경로 (예: /uploads/carousel/abc.png)
 */
export async function saveRemoteImage(
  url: string,
  folder: string,
  filename?: string
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = url.includes(".webp") ? "webp" : "png";
  const name = filename ?? `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const dir = join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buffer);

  return `/uploads/${folder}/${name}`;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add src/lib/file-upload.ts public/uploads/.gitkeep
git commit -m "feat: 원격 이미지 로컬 저장 유틸 추가"
```

---

### Task A3: DALL-E Image Provider

**Files:**
- Create: `src/ai/image/dalle.provider.ts`

- [ ] **Step 1: dalle.provider.ts 작성**

```typescript
// src/ai/image/dalle.provider.ts
import OpenAI from "openai";
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";
import { saveRemoteImage } from "@/lib/file-upload";

export class DalleProvider implements ImageProvider {
  readonly name = "dalle";
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const count = options?.count ?? 1;
    const size = this.resolveSize(options?.width, options?.height);

    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1, // dall-e-3는 n=1만 지원, 여러 장은 반복 호출
      size,
      response_format: "url",
    });

    // 여러 장 요청 시 순차 생성
    const urls: string[] = [];
    for (let i = 0; i < count; i++) {
      const res = i === 0
        ? response
        : await this.client.images.generate({
            model: "dall-e-3",
            prompt,
            n: 1,
            size,
            response_format: "url",
          });

      const remoteUrl = res.data[0]?.url;
      if (!remoteUrl) throw new Error("DALL-E 이미지 URL 없음");

      // 로컬에 저장 (dall-e URL은 1시간 후 만료)
      const localPath = await saveRemoteImage(remoteUrl, "carousel");
      urls.push(localPath);
    }

    return { urls };
  }

  private resolveSize(w?: number, h?: number): "1024x1024" | "1792x1024" | "1024x1792" {
    if (w && h && w > h) return "1792x1024";
    if (w && h && h > w) return "1024x1792";
    return "1024x1024";
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

---

### Task A4: FLUX Image Provider

**Files:**
- Create: `src/ai/image/flux.provider.ts`

- [ ] **Step 1: @fal-ai/client 설치**

```bash
cd d:/Dev/social && npm install @fal-ai/client
```
Expected: `added N packages`

- [ ] **Step 2: flux.provider.ts 작성**

```typescript
// src/ai/image/flux.provider.ts
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";
import { saveRemoteImage } from "@/lib/file-upload";

export class FluxProvider implements ImageProvider {
  readonly name = "flux";

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    // fal.ai 동적 import (서버 사이드 전용)
    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: process.env.FAL_KEY ?? "" });

    const count = options?.count ?? 1;
    const imageSize = this.resolveSize(options?.width, options?.height);

    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        num_images: count,
        image_size: imageSize,
      },
    }) as { images: Array<{ url: string }> };

    const urls: string[] = [];
    for (const img of result.images) {
      const localPath = await saveRemoteImage(img.url, "carousel");
      urls.push(localPath);
    }

    return { urls };
  }

  private resolveSize(w?: number, h?: number): string {
    if (w && h && w > h) return "landscape_16_9";
    if (w && h && h > w) return "portrait_9_16";
    return "square_hd";
  }
}
```

- [ ] **Step 3: .env.example에 FAL_KEY 추가**

```bash
# d:/Dev/social/.env.example 에 다음 줄 추가
echo "FAL_KEY=your_fal_api_key_here" >> d:/Dev/social/.env.example
```

- [ ] **Step 4: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

---

### Task A5: ai/index.ts에 getImageProvider 추가

**Files:**
- Modify: `src/ai/index.ts`

- [ ] **Step 1: index.ts 수정**

```typescript
// src/ai/index.ts 전체 교체
import type { LLMProvider } from "./ai.provider";
import type { ImageProvider } from "./image/image.provider";
import { aiConfig } from "@/config/ai.config";
import { AppError, ErrorCode } from "@/lib/error";
import { TextGenerator } from "./generators/text.generator";
import { CarouselGenerator } from "./generators/carousel.generator";
import { BlogGenerator } from "./generators/blog.generator";
import { BulkGenerator } from "./generators/bulk.generator";
import { RepurposeGenerator } from "./generators/repurpose.generator";

export function getLLMProvider(): LLMProvider {
  switch (aiConfig.llmProvider) {
    case "openai": {
      const { OpenAIProvider } = require("./providers/openai.provider") as { OpenAIProvider: new () => LLMProvider };
      return new OpenAIProvider();
    }
    case "anthropic": {
      const { AnthropicProvider } = require("./providers/anthropic.provider") as { AnthropicProvider: new () => LLMProvider };
      return new AnthropicProvider();
    }
    default:
      throw new AppError(`지원하지 않는 LLM provider: ${aiConfig.llmProvider}`, ErrorCode.AI_PROVIDER_UNAVAILABLE);
  }
}

export function getImageProvider(): ImageProvider {
  switch (aiConfig.imageProvider) {
    case "dalle": {
      const { DalleProvider } = require("./image/dalle.provider") as { DalleProvider: new () => ImageProvider };
      return new DalleProvider();
    }
    case "flux": {
      const { FluxProvider } = require("./image/flux.provider") as { FluxProvider: new () => ImageProvider };
      return new FluxProvider();
    }
    default:
      throw new AppError(`지원하지 않는 이미지 provider: ${aiConfig.imageProvider}`, ErrorCode.AI_PROVIDER_UNAVAILABLE);
  }
}

export function getTextGenerator(): TextGenerator {
  return new TextGenerator(getLLMProvider());
}

export function getCarouselGenerator(): CarouselGenerator {
  return new CarouselGenerator(getLLMProvider(), getImageProvider());
}

export function getBlogGenerator(): BlogGenerator {
  return new BlogGenerator(getLLMProvider());
}

export function getBulkGenerator(): BulkGenerator {
  return new BulkGenerator(getLLMProvider());
}

export function getRepurposeGenerator(): RepurposeGenerator {
  return new RepurposeGenerator(getLLMProvider());
}
```

---

### Task A6: CarouselGenerator

**Files:**
- Create: `src/ai/generators/carousel.generator.ts`

- [ ] **Step 1: carousel.generator.ts 작성**

```typescript
// src/ai/generators/carousel.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { ImageProvider } from "../image/image.provider";
import type { GenerateCarouselInput, GeneratedCarousel, CarouselSlide } from "@/types/content.types";

export class CarouselGenerator {
  constructor(
    private llm: LLMProvider,
    private imageProvider: ImageProvider
  ) {}

  /** 슬라이드 텍스트만 생성 (이미지 없음) */
  async generateSlideTexts(input: GenerateCarouselInput): Promise<GeneratedCarousel> {
    const count = input.slideCount ?? 5;

    const prompt = `병원 SNS 카드뉴스(슬라이드 ${count}장)를 작성해주세요.
주제: ${input.topic}
${input.additionalContext ? `추가 정보: ${input.additionalContext}` : ""}

각 슬라이드의 텍스트를 아래 JSON 형식으로 출력하세요. 다른 설명 없이 JSON만 출력하세요.
{
  "caption": "전체 캡션 (해시태그 포함)",
  "slides": [
    { "order": 1, "text": "슬라이드 1 텍스트" },
    ...
  ]
}`;

    const raw = await this.llm.generateText(prompt, { temperature: 0.7 });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("캐러셀 JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]) as {
      caption: string;
      slides: Array<{ order: number; text: string }>;
    };

    return {
      slides: parsed.slides.map((s) => ({ order: s.order, text: s.text })),
      caption: parsed.caption,
    };
  }

  /** 슬라이드 텍스트 + 이미지 생성 */
  async generateWithImages(
    input: GenerateCarouselInput
  ): Promise<GeneratedCarousel> {
    const textResult = await this.generateSlideTexts(input);

    // 슬라이드별 이미지 프롬프트 생성
    const style = input.style ?? "깔끔한 미니멀 디자인, 병원 브랜딩, 한국어 텍스트 제외";
    const imageResults = await Promise.all(
      textResult.slides.map((slide) =>
        this.imageProvider.generateImage(
          `${input.topic} - ${slide.text ?? ""}. ${style}`,
          { width: 1080, height: 1080, count: 1 }
        )
      )
    );

    const slides: CarouselSlide[] = textResult.slides.map((slide, i) => ({
      ...slide,
      imageUrl: imageResults[i]?.urls[0],
    }));

    return { slides, caption: textResult.caption };
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

---

### Task A7: 카드뉴스 생성 API

**Files:**
- Create: `src/app/api/content/generate/carousel/route.ts`

- [ ] **Step 1: carousel API route 작성**

```typescript
// src/app/api/content/generate/carousel/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getCarouselGenerator } from "@/ai";
import type { GenerateCarouselInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as GenerateCarouselInput & { generateImages?: boolean };
  const generator = getCarouselGenerator();

  const result = body.generateImages
    ? await generator.generateWithImages(body)
    : await generator.generateSlideTexts(body);

  return successResponse(result);
});
```

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

```bash
git add src/ai/ src/lib/file-upload.ts src/app/api/content/generate/carousel/
git commit -m "feat: 카드뉴스 AI 생성 (DALL-E/FLUX ImageProvider + CarouselGenerator + API)"
```

---

### Task A8: CarouselSlideCard + CarouselPreview 컴포넌트

**Files:**
- Create: `src/components/content/CarouselSlideCard.tsx`
- Create: `src/components/content/CarouselPreview.tsx`

- [ ] **Step 1: CarouselSlideCard.tsx 작성**

```typescript
// src/components/content/CarouselSlideCard.tsx
"use client";

import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CarouselSlide } from "@/types/content.types";

interface Props {
  slide: CarouselSlide;
  index: number;
  onChange: (updated: CarouselSlide) => void;
}

export function CarouselSlideCard({ slide, index, onChange }: Props) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 이미지 영역 */}
      <div className="relative bg-muted aspect-square w-full max-w-[200px] mx-auto">
        {slide.imageUrl ? (
          <Image
            src={slide.imageUrl}
            alt={`슬라이드 ${index + 1}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            이미지 없음
          </div>
        )}
        <Badge className="absolute top-2 left-2" variant="secondary">
          {index + 1}
        </Badge>
      </div>

      {/* 텍스트 편집 */}
      <div className="p-3">
        <Textarea
          value={slide.text ?? ""}
          onChange={(e) => onChange({ ...slide, text: e.target.value })}
          rows={3}
          placeholder={`슬라이드 ${index + 1} 텍스트...`}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CarouselPreview.tsx 작성**

```typescript
// src/components/content/CarouselPreview.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CarouselSlide } from "@/types/content.types";

interface Props {
  slides: CarouselSlide[];
  caption: string;
}

export function CarouselPreview({ slides, caption }: Props) {
  const [current, setCurrent] = useState(0);
  if (slides.length === 0) return null;

  const slide = slides[current]!;

  return (
    <div className="space-y-4">
      {/* 슬라이드 뷰어 */}
      <div className="relative bg-muted rounded-xl aspect-square max-w-sm mx-auto overflow-hidden">
        {slide.imageUrl ? (
          <Image src={slide.imageUrl} alt={`슬라이드 ${current + 1}`} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            이미지 없음
          </div>
        )}

        {/* 슬라이드 텍스트 오버레이 */}
        {slide.text && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-4">
            <p className="text-white text-sm whitespace-pre-wrap">{slide.text}</p>
          </div>
        )}

        {/* 이전/다음 버튼 */}
        {slides.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
              onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))}
              disabled={current === slides.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* 슬라이드 인디케이터 */}
      <div className="flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === current ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>

      {/* 캡션 */}
      {caption && (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-3 bg-muted/30">
          {caption}
        </div>
      )}
    </div>
  );
}
```

---

### Task A9: 카드뉴스 페이지 UI

**Files:**
- Modify: `src/app/content/carousel/page.tsx` (전면 교체)
- Modify: `src/hooks/useContent.ts` (useCarouselGenerator 추가)

- [ ] **Step 1: useContent.ts에 useCarouselGenerator 추가**

`src/hooks/useContent.ts` 파일 끝에 다음을 추가:

```typescript
// src/hooks/useContent.ts 끝에 추가
import type { GenerateCarouselInput, GeneratedCarousel } from "@/types/content.types";

export function useCarouselGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      input: GenerateCarouselInput & { generateImages?: boolean }
    ): Promise<GeneratedCarousel | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fetch("/api/content/generate/carousel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json() as {
          success: boolean;
          data: GeneratedCarousel;
          error?: { message: string };
        };
        if (!data.success) throw new Error(data.error?.message ?? "생성 실패");
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { generate, loading, error };
}
```

- [ ] **Step 2: carousel/page.tsx 작성**

```typescript
// src/app/content/carousel/page.tsx
"use client";

import { useState } from "react";
import { Wand2, Save, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCarouselGenerator } from "@/hooks/useContent";
import type { CarouselSlide, GeneratedCarousel } from "@/types/content.types";

export default function CarouselPage() {
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState("5");
  const [style, setStyle] = useState("minimal");
  const [generateImages, setGenerateImages] = useState(false);
  const [result, setResult] = useState<GeneratedCarousel | null>(null);
  const [activeTab, setActiveTab] = useState("generate");

  const { generate, loading } = useCarouselGenerator();

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
      toast.error("생성에 실패했습니다.");
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
      const res = await fetch("/api/content", {
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
      const data = await res.json() as { success: boolean };
      if (data.success) toast.success("카드뉴스가 저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    }
  };

  const STYLES = [
    { value: "minimal", label: "미니멀" },
    { value: "vivid", label: "생동감있는" },
    { value: "professional", label: "전문적인" },
    { value: "warm", label: "따뜻한" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">카드뉴스 랩</h1>
        <p className="text-muted-foreground mt-1">
          AI로 카드뉴스 슬라이드를 자동 생성합니다.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
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
                  <CarouselSlideCard
                    key={i}
                    slide={slide}
                    index={i}
                    onChange={(updated) => handleSlideChange(i, updated)}
                  />
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
```

- [ ] **Step 3: Tabs 컴포넌트 설치 확인**

```bash
cd d:/Dev/social && npx shadcn@latest add tabs switch 2>&1 | tail -5
```

- [ ] **Step 4: 빌드 확인**

```bash
cd d:/Dev/social && npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
git add src/components/content/ src/app/content/carousel/ src/hooks/useContent.ts
git commit -m "feat: 카드뉴스 랩 UI (3탭 — 생성/편집/미리보기)"
```

---

## 서브시스템 B: 블로그 + 대량기획 + 리퍼포징

### Task B1: BlogGenerator + API + 페이지

**Files:**
- Create: `src/ai/generators/blog.generator.ts`
- Create: `src/app/api/content/generate/blog/route.ts`
- Modify: `src/app/content/blog/page.tsx` (전면 교체)
- Modify: `src/hooks/useContent.ts` (useBlogGenerator 추가)

- [ ] **Step 1: blog.generator.ts 작성**

```typescript
// src/ai/generators/blog.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { GenerateBlogInput, GeneratedBlog } from "@/types/content.types";

export class BlogGenerator {
  constructor(private llm: LLMProvider) {}

  async generateBlog(input: GenerateBlogInput): Promise<GeneratedBlog> {
    const targetLength = input.targetLength ?? 800;
    const keywordStr = input.keywords?.join(", ") ?? "";

    const prompt = `병원 블로그 아티클을 작성해주세요.
주제: ${input.topic}
목표 분량: ${targetLength}자 이상
${keywordStr ? `포함 키워드: ${keywordStr}` : ""}
${input.additionalContext ? `추가 정보: ${input.additionalContext}` : ""}

다음 JSON 형식으로만 출력하세요. 설명 없이 JSON만:
{
  "title": "블로그 제목",
  "excerpt": "150자 이내 요약",
  "body": "본문 (마크다운 형식)",
  "tags": ["태그1", "태그2"]
}`;

    const raw = await this.llm.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 4096,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("블로그 JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      excerpt: string;
      body: string;
      tags: string[];
    };

    return {
      title: parsed.title,
      body: parsed.body,
      excerpt: parsed.excerpt,
      tags: parsed.tags,
      wordCount: parsed.body.length,
    };
  }
}
```

- [ ] **Step 2: blog API route 작성**

```typescript
// src/app/api/content/generate/blog/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getBlogGenerator } from "@/ai";
import type { GenerateBlogInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as GenerateBlogInput;
  const generator = getBlogGenerator();
  const result = await generator.generateBlog(body);
  return successResponse(result);
});
```

- [ ] **Step 3: useContent.ts에 useBlogGenerator 추가**

`src/hooks/useContent.ts` 끝에 추가:

```typescript
import type { GenerateBlogInput, GeneratedBlog } from "@/types/content.types";

export function useBlogGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: GenerateBlogInput): Promise<GeneratedBlog | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fetch("/api/content/generate/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json() as {
          success: boolean;
          data: GeneratedBlog;
          error?: { message: string };
        };
        if (!data.success) throw new Error(data.error?.message ?? "생성 실패");
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { generate, loading, error };
}
```

- [ ] **Step 4: blog/page.tsx 작성**

```typescript
// src/app/content/blog/page.tsx
"use client";

import { useState } from "react";
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
  const [topic, setTopic] = useState("");
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
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blog",
          title: result.title,
          contentText: result.body,
          contentData: JSON.stringify({ excerpt: result.excerpt, tags: result.tags }),
        }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) toast.success("블로그가 저장되었습니다.");
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
```

- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
cd d:/Dev/social && npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10
```

```bash
git add src/ai/generators/blog.generator.ts src/app/api/content/generate/blog/ src/app/content/blog/ src/hooks/useContent.ts
git commit -m "feat: 블로그 아티클 AI 생성 (BlogGenerator + API + 페이지)"
```

---

### Task B2: BulkGenerator + API + 페이지

**Files:**
- Create: `src/ai/generators/bulk.generator.ts`
- Create: `src/app/api/content/generate/bulk/route.ts`
- Modify: `src/app/content/bulk/page.tsx` (전면 교체)
- Modify: `src/hooks/useContent.ts` (useBulkGenerator 추가)

- [ ] **Step 1: bulk.generator.ts 작성**

```typescript
// src/ai/generators/bulk.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { BulkPlan } from "@/types/content.types";
import type { PlatformType, } from "@/types/platform.types";

interface BulkInput {
  theme: string;
  count: number;
  platforms: PlatformType[];
  period?: string; // 예: "2주치", "1달치"
}

export class BulkGenerator {
  constructor(private llm: LLMProvider) {}

  async generateIdeas(input: BulkInput): Promise<BulkPlan> {
    const platformStr = input.platforms.join(", ");
    const prompt = `병원 SNS 콘텐츠 ${input.count}개 기획안을 만들어주세요.
테마: ${input.theme}
기간: ${input.period ?? `${input.count}개`}
플랫폼: ${platformStr}

각 아이디어를 다음 JSON 형식으로 출력하세요. JSON만 출력:
{
  "theme": "${input.theme}",
  "ideas": [
    {
      "title": "게시물 제목",
      "topic": "구체적인 주제/내용 방향",
      "platform": "${input.platforms[0]}",
      "contentType": "text",
      "suggestedTone": "전문적이면서 친근한",
      "hashtags": ["해시태그1", "해시태그2"]
    }
  ]
}

contentType은 text, carousel, blog 중 하나. platform은 ${platformStr} 중 하나.`;

    const raw = await this.llm.generateText(prompt, {
      temperature: 0.8,
      maxTokens: 4096,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("대량기획 JSON 파싱 실패");

    return JSON.parse(jsonMatch[0]) as BulkPlan;
  }
}
```

- [ ] **Step 2: bulk API route 작성**

```typescript
// src/app/api/content/generate/bulk/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getBulkGenerator } from "@/ai";
import type { PlatformType } from "@/types/platform.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as {
    theme: string;
    count: number;
    platforms: PlatformType[];
    period?: string;
  };
  const generator = getBulkGenerator();
  const result = await generator.generateIdeas(body);
  return successResponse(result);
});
```

- [ ] **Step 3: useContent.ts에 useBulkGenerator 추가**

`src/hooks/useContent.ts` 끝에 추가:

```typescript
import type { BulkPlan } from "@/types/content.types";
import type { PlatformType } from "@/types/platform.types";

interface BulkInput {
  theme: string;
  count: number;
  platforms: PlatformType[];
  period?: string;
}

export function useBulkGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: BulkInput): Promise<BulkPlan | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fetch("/api/content/generate/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json() as {
          success: boolean;
          data: BulkPlan;
          error?: { message: string };
        };
        if (!data.success) throw new Error(data.error?.message ?? "생성 실패");
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { generate, loading, error };
}
```

- [ ] **Step 4: bulk/page.tsx 작성**

```typescript
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
    if (idea.contentType === "blog") router.push(`/content/blog?${params}`);
    else if (idea.contentType === "carousel") router.push(`/content/carousel?${params}`);
    else router.push(`/content/text?${params}`);
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
```

- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
cd d:/Dev/social && npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10
```

```bash
git add src/ai/generators/bulk.generator.ts src/app/api/content/generate/bulk/ src/app/content/bulk/ src/hooks/useContent.ts
git commit -m "feat: 대량 콘텐츠 기획 (BulkGenerator + API + 페이지)"
```

---

### Task B3: RepurposeGenerator + API + 페이지

**Files:**
- Create: `src/ai/generators/repurpose.generator.ts`
- Create: `src/app/api/content/generate/repurpose/route.ts`
- Modify: `src/app/content/repurpose/page.tsx` (전면 교체)
- Modify: `src/hooks/useContent.ts` (useRepurposeGenerator 추가)

- [ ] **Step 1: repurpose.generator.ts 작성**

```typescript
// src/ai/generators/repurpose.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { RepurposeInput, RepurposeResult, ContentType } from "@/types/content.types";
import type { PlatformType } from "@/types/platform.types";

const FORMAT_PROMPTS: Record<ContentType, string> = {
  text: "SNS 텍스트 게시물 (해시태그 포함, 해당 플랫폼 최적화)",
  carousel: "카드뉴스 슬라이드 구성 (슬라이드별 핵심 내용 요약)",
  blog: "블로그 아티클 (제목, 본문, 태그 포함)",
  short_form: "숏폼 영상 스크립트 (훅 + 본문 + CTA)",
  thread: "쓰레드/연속 게시물 (번호 붙인 연속 트윗/쓰레드)",
};

export class RepurposeGenerator {
  constructor(private llm: LLMProvider) {}

  async repurpose(input: RepurposeInput): Promise<RepurposeResult[]> {
    const results: RepurposeResult[] = [];

    for (const format of input.targetFormats) {
      const platforms = input.targetPlatforms ?? [];
      const platformStr = platforms.length > 0 ? `대상 플랫폼: ${platforms.join(", ")}` : "";

      const prompt = `다음 원본 콘텐츠를 ${FORMAT_PROMPTS[format] ?? format} 형식으로 변환해주세요.
원본 유형: ${input.sourceType}
${platformStr}

원본 내용:
${input.sourceContent}

변환된 콘텐츠만 출력하세요. 형식: JSON
{
  "format": "${format}",
  "platform": ${platforms[0] ? `"${platforms[0]}"` : "null"},
  "title": "제목 (있는 경우)",
  "text": "변환된 텍스트 본문",
  "hashtags": ["해시태그"]
}`;

      const raw = await this.llm.generateText(prompt, { temperature: 0.7 });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      try {
        const parsed = JSON.parse(jsonMatch[0]) as RepurposeResult;
        results.push(parsed);
      } catch {
        // 파싱 실패한 형식은 건너뜀
      }
    }

    return results;
  }
}
```

- [ ] **Step 2: repurpose API route 작성**

```typescript
// src/app/api/content/generate/repurpose/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getRepurposeGenerator } from "@/ai";
import type { RepurposeInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as RepurposeInput;
  const generator = getRepurposeGenerator();
  const results = await generator.repurpose(body);
  return successResponse(results);
});
```

- [ ] **Step 3: useContent.ts에 useRepurposeGenerator 추가**

`src/hooks/useContent.ts` 끝에 추가:

```typescript
import type { RepurposeInput, RepurposeResult } from "@/types/content.types";

export function useRepurposeGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repurpose = useCallback(
    async (input: RepurposeInput): Promise<RepurposeResult[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fetch("/api/content/generate/repurpose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json() as {
          success: boolean;
          data: RepurposeResult[];
          error?: { message: string };
        };
        if (!data.success) throw new Error(data.error?.message ?? "변환 실패");
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { repurpose, loading, error };
}
```

- [ ] **Step 4: repurpose/page.tsx 작성**

```typescript
// src/app/content/repurpose/page.tsx
"use client";

import { useState } from "react";
import { RefreshCw, Copy, Save } from "lucide-react";
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

const SOURCE_TYPES = [
  { value: "blog", label: "블로그 아티클" },
  { value: "video", label: "영상 스크립트" },
  { value: "idea", label: "아이디어/메모" },
  { value: "script", label: "강의/발표 스크립트" },
] as const;

const TARGET_FORMATS: { value: ContentType; label: string }[] = [
  { value: "text", label: "SNS 텍스트" },
  { value: "carousel", label: "카드뉴스 구성" },
  { value: "short_form", label: "숏폼 스크립트" },
  { value: "thread", label: "쓰레드" },
];

export default function RepurposePage() {
  const [sourceType, setSourceType] = useState<"blog" | "video" | "idea" | "script">("blog");
  const [sourceContent, setSourceContent] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<ContentType[]>(["text"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(["instagram"]);
  const [results, setResults] = useState<RepurposeResult[]>([]);

  const { repurpose, loading } = useRepurposeGenerator();

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
    if (res) { setResults(res); toast.success(`${res.length}개 형식으로 변환되었습니다.`); }
    else toast.error("변환에 실패했습니다.");
  };

  const handleSave = async (result: RepurposeResult) => {
    try {
      await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: result.format,
          title: result.title ?? `리퍼포징: ${sourceContent.substring(0, 30)}`,
          contentText: result.text,
        }),
      });
      toast.success("저장되었습니다.");
    } catch { toast.error("저장에 실패했습니다."); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">콘텐츠 리퍼포징</h1>
        <p className="text-muted-foreground mt-1">기존 콘텐츠를 다양한 형식으로 재활용합니다.</p>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <Label>원본 유형</Label>
          <Select value={sourceType} onValueChange={(v) => v && setSourceType(v as typeof sourceType)}>
            <SelectTrigger className="w-48">
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

      {results.length > 0 && (
        <div className="grid gap-4 max-w-2xl">
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
                  <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(result.text); toast.success("복사됨"); }}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />복사
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSave(result)}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
cd d:/Dev/social && npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10
```

```bash
git add src/ai/generators/repurpose.generator.ts src/app/api/content/generate/repurpose/ src/app/content/repurpose/ src/hooks/useContent.ts
git commit -m "feat: 콘텐츠 리퍼포징 (RepurposeGenerator + API + 페이지)"
```

---

## 서브시스템 C: 플랫폼 어댑터 (TikTok · YouTube · X)

> **주의**: X(Twitter) API v2 무료 플랜은 쓰기 전용 (읽기 불가). TikTok Content Posting API는 비즈니스 계정 심사 필요. YouTube Data API v3는 OAuth 2.0 + Google Cloud Console 설정 필요.

### Task C1: PKCE 지원 OAuth 흐름 업데이트

X와 TikTok은 OAuth 2.0 PKCE를 요구함. `auth/[platform]` route에서 `code_verifier`를 생성해 httpOnly 쿠키에 저장하고, `callback/[platform]` route에서 읽어 사용.

**Files:**
- Modify: `src/app/api/accounts/auth/[platform]/route.ts`
- Modify: `src/app/api/accounts/callback/[platform]/route.ts`
- Modify: `src/services/account.service.ts`

- [ ] **Step 1: PKCE 유틸 함수 — lib/pkce.ts 작성**

```typescript
// src/lib/pkce.ts
import { createHash, randomBytes } from "crypto";

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
```

- [ ] **Step 2: auth/[platform]/route.ts 수정 (PKCE 쿠키 설정)**

```typescript
// src/app/api/accounts/auth/[platform]/route.ts 전체 교체
import { NextResponse } from "next/server";
import { accountService } from "@/services/account.service";
import { generateCodeVerifier, generateCodeChallenge } from "@/lib/pkce";
import type { PlatformType } from "@/types/platform.types";

const PKCE_PLATFORMS: PlatformType[] = ["x", "tiktok"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const state = Math.random().toString(36).substring(2);

  let authUrl: string;
  const response = NextResponse.redirect("");

  if (PKCE_PLATFORMS.includes(platform as PlatformType)) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    authUrl = accountService.getAuthUrl(platform as PlatformType, state, codeChallenge);
    // code_verifier를 httpOnly 쿠키에 저장 (10분 만료)
    response.cookies.set(`pkce_verifier_${platform}`, codeVerifier, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
    });
  } else {
    authUrl = accountService.getAuthUrl(platform as PlatformType, state);
  }

  return NextResponse.redirect(authUrl, {
    headers: response.headers,
  });
}
```

- [ ] **Step 3: callback/[platform]/route.ts 수정 (PKCE 쿠키 읽기)**

```typescript
// src/app/api/accounts/callback/[platform]/route.ts 전체 교체
import { NextRequest, NextResponse } from "next/server";
import { accountService } from "@/services/account.service";
import { logger } from "@/lib/logger";
import type { PlatformType } from "@/types/platform.types";

const PKCE_PLATFORMS: PlatformType[] = ["x", "tiktok"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    logger.warn(`OAuth 오류 (${platform}): ${error}`);
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=code_missing`
    );
  }

  try {
    let codeVerifier: string | undefined;
    if (PKCE_PLATFORMS.includes(platform as PlatformType)) {
      codeVerifier = req.cookies.get(`pkce_verifier_${platform}`)?.value;
    }

    await accountService.connect({
      platform: platform as PlatformType,
      code,
      codeVerifier,
    });

    const response = NextResponse.redirect(
      `${process.env.APP_URL}/accounts?success=connected`
    );
    // 사용한 쿠키 삭제
    response.cookies.delete(`pkce_verifier_${platform}`);
    return response;
  } catch (err) {
    logger.error(`계정 연동 실패 (${platform}):`, err);
    const message = err instanceof Error ? err.message : "연동 실패";
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=${encodeURIComponent(message)}`
    );
  }
}
```

- [ ] **Step 4: account.service.ts — getAuthUrl + connect 시그니처 수정**

`src/services/account.service.ts`에서 `getAuthUrl`과 `connect` 메서드를 찾아 수정:

```typescript
// getAuthUrl: codeChallenge 파라미터 추가
getAuthUrl(platform: PlatformType, state?: string, codeChallenge?: string): string {
  const adapter = getPlatformAdapter(platform);
  return adapter.getAuthUrl(state, codeChallenge);
},

// connect: codeVerifier 파라미터 추가
async connect(input: { platform: PlatformType; code: string; codeVerifier?: string }) {
  const adapter = getPlatformAdapter(input.platform);
  const tokenResult = await adapter.exchangeToken(input.code, input.codeVerifier);
  // ... 나머지 동일
```

- [ ] **Step 5: platform.adapter.ts 인터페이스 시그니처 수정**

`src/adapters/platform.adapter.ts`에서:

```typescript
// 기존
getAuthUrl(state?: string): string;
exchangeToken(code: string): Promise<TokenResult>;

// 변경
getAuthUrl(state?: string, codeChallenge?: string): string;
exchangeToken(code: string, codeVerifier?: string): Promise<TokenResult>;
```

- [ ] **Step 6: instagram.adapter.ts + threads.adapter.ts 시그니처 업데이트**

`InstagramAdapter`와 `ThreadsAdapter`의 `getAuthUrl`/`exchangeToken` 시그니처에 파라미터 추가 (무시):

```typescript
// instagram.adapter.ts
getAuthUrl(state?: string, _codeChallenge?: string): string { ... }
async exchangeToken(code: string, _codeVerifier?: string): Promise<TokenResult> { ... }

// threads.adapter.ts 동일
```

- [ ] **Step 7: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/lib/pkce.ts src/app/api/accounts/auth/ src/app/api/accounts/callback/ src/services/account.service.ts src/adapters/platform.adapter.ts src/adapters/instagram.adapter.ts src/adapters/threads.adapter.ts
git commit -m "feat: OAuth PKCE 지원 (X, TikTok용 code_verifier 쿠키 기반)"
```

---

### Task C2: X (Twitter) 어댑터

**Files:**
- Modify: `src/adapters/x.adapter.ts` (전면 교체)

- [ ] **Step 1: x.adapter.ts 전면 교체**

```typescript
// src/adapters/x.adapter.ts
import type { PlatformAdapter } from "./platform.adapter";
import type {
  PlatformType, TokenResult, ProfileData, PublishResult,
  AnalyticsData, AccountAnalytics, DateRange, Comment, DirectMessage,
} from "@/types/platform.types";
import type { TextContent, CarouselContent, VideoContent } from "@/types/content.types";
import type { SocialAccount } from "@/generated/prisma/client";
import { AppError, ErrorCode } from "@/lib/error";
import { decrypt } from "@/lib/encryption";
import { getPlatformOAuthConfig } from "@/config/platforms.config";
import { generateCodeChallenge } from "@/lib/pkce";

export class XAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "x";
  private readonly baseUrl = "https://api.twitter.com/2";

  getAuthUrl(state?: string, codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("x");
    if (!config?.clientId) throw new AppError("X OAuth가 설정되지 않았습니다.", ErrorCode.OAUTH_FAILED, 500);

    const challenge = codeChallenge ?? generateCodeChallenge("default");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
      scope: config.scopes.join(" "),
      state: state ?? "state",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeToken(code: string, codeVerifier?: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("x");
    if (!config) throw new AppError("X 설정 없음", ErrorCode.OAUTH_FAILED);
    if (!codeVerifier) throw new AppError("X OAuth: code_verifier 없음", ErrorCode.OAUTH_FAILED);

    // X API v2: Basic Auth (clientId:clientSecret) + form-encoded body
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new AppError(`X 토큰 교환 실패: ${err}`, ErrorCode.OAUTH_FAILED);
    }

    const data = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("x");
    if (!config) throw new AppError("X 설정 없음", ErrorCode.OAUTH_FAILED);

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new AppError("X 토큰 갱신 실패", ErrorCode.TOKEN_EXPIRED);
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const res = await fetch(`${this.baseUrl}/users/me?user.fields=profile_image_url,public_metrics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new AppError("X 프로필 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      data: { id: string; name: string; username: string; profile_image_url?: string };
    };
    return {
      platformUserId: data.data.id,
      username: data.data.username,
      displayName: data.data.name,
      profileImageUrl: data.data.profile_image_url,
    };
  }

  async publishText(account: SocialAccount, content: TextContent): Promise<PublishResult> {
    const token = decrypt(account.encryptedAccessToken);
    const res = await fetch(`${this.baseUrl}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content.text }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `트윗 발행 실패: ${err}` };
    }

    const data = await res.json() as { data: { id: string } };
    return {
      success: true,
      platformPostId: data.data.id,
      url: `https://x.com/i/web/status/${data.data.id}`,
    };
  }

  async publishCarousel(_account: SocialAccount, _content: CarouselContent): Promise<PublishResult> {
    // X는 이미지 첨부 트윗을 위해 미디어 업로드 API (v1.1) 필요
    // 무료 플랜에서는 미디어 업로드 제한이 있어 텍스트만 발행
    return { success: false, error: "X 카드뉴스 발행: 이미지 첨부는 미구현 (텍스트만 지원)" };
  }

  async publishVideo(_account: SocialAccount, _content: VideoContent): Promise<PublishResult> {
    return { success: false, error: "X 영상 발행: 미디어 업로드 API 별도 구현 필요" };
  }

  async getComments(_account: SocialAccount, _postId: string): Promise<Comment[]> { return []; }
  async replyToComment(_account: SocialAccount, _commentId: string, _text: string): Promise<void> {}
  async getMessages(_account: SocialAccount): Promise<DirectMessage[]> { return []; }
  async sendMessage(_account: SocialAccount, _userId: string, _text: string): Promise<void> {}

  async getPostAnalytics(_account: SocialAccount, _postId: string): Promise<AnalyticsData> {
    return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
  }
  async getAccountAnalytics(_account: SocialAccount, dateRange: DateRange): Promise<AccountAnalytics> {
    return { platform: "x", dateRange, totalImpressions: 0, totalReach: 0, totalEngagement: 0, followerGrowth: 0, topPosts: [] };
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```
Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add src/adapters/x.adapter.ts
git commit -m "feat: X(Twitter) OAuth 2.0 PKCE + 텍스트 발행 구현"
```

---

### Task C3: TikTok 어댑터

**Files:**
- Modify: `src/adapters/tiktok.adapter.ts` (전면 교체)

- [ ] **Step 1: tiktok.adapter.ts 전면 교체**

```typescript
// src/adapters/tiktok.adapter.ts
import type { PlatformAdapter } from "./platform.adapter";
import type {
  PlatformType, TokenResult, ProfileData, PublishResult,
  AnalyticsData, AccountAnalytics, DateRange, Comment, DirectMessage,
} from "@/types/platform.types";
import type { TextContent, CarouselContent, VideoContent } from "@/types/content.types";
import type { SocialAccount } from "@/generated/prisma/client";
import { AppError, ErrorCode } from "@/lib/error";
import { decrypt } from "@/lib/encryption";
import { getPlatformOAuthConfig } from "@/config/platforms.config";

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "tiktok";
  private readonly baseUrl = "https://open.tiktokapis.com/v2";

  getAuthUrl(state?: string, codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("tiktok");
    if (!config?.clientId) throw new AppError("TikTok OAuth가 설정되지 않았습니다.", ErrorCode.OAUTH_FAILED, 500);

    const params = new URLSearchParams({
      client_key: config.clientId,
      response_type: "code",
      scope: config.scopes.join(","),
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
      state: state ?? "state",
    });
    if (codeChallenge) {
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeToken(code: string, codeVerifier?: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("tiktok");
    if (!config) throw new AppError("TikTok 설정 없음", ErrorCode.OAUTH_FAILED);

    const body: Record<string, string> = {
      client_key: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
    };
    if (codeVerifier) body["code_verifier"] = codeVerifier;

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new AppError(`TikTok 토큰 교환 실패: ${err}`, ErrorCode.OAUTH_FAILED);
    }

    const data = await res.json() as {
      data: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        refresh_expires_in: number;
      };
    };
    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("tiktok");
    if (!config) throw new AppError("TikTok 설정 없음", ErrorCode.OAUTH_FAILED);

    const res = await fetch(`${this.baseUrl}/oauth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new AppError("TikTok 토큰 갱신 실패", ErrorCode.TOKEN_EXPIRED);
    const data = await res.json() as { data: { access_token: string; refresh_token: string; expires_in: number } };
    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
    };
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const res = await fetch(`${this.baseUrl}/user/info/?fields=open_id,display_name,avatar_url,username`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new AppError("TikTok 프로필 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      data: { user: { open_id: string; display_name: string; username?: string; avatar_url?: string } };
    };
    return {
      platformUserId: data.data.user.open_id,
      username: data.data.user.username ?? data.data.user.open_id,
      displayName: data.data.user.display_name,
      profileImageUrl: data.data.user.avatar_url,
    };
  }

  // TikTok은 텍스트 전용 게시물 미지원 (영상 필수)
  async publishText(_account: SocialAccount, _content: TextContent): Promise<PublishResult> {
    return { success: false, error: "TikTok은 텍스트 전용 게시물을 지원하지 않습니다. 영상을 업로드하세요." };
  }

  async publishCarousel(_account: SocialAccount, _content: CarouselContent): Promise<PublishResult> {
    return { success: false, error: "TikTok 카드뉴스: 사진 슬라이드쇼 API는 Phase 4에서 구현됩니다." };
  }

  // TikTok 영상 업로드 (Content Posting API)
  async publishVideo(account: SocialAccount, content: VideoContent): Promise<PublishResult> {
    const token = decrypt(account.encryptedAccessToken);

    // 1단계: 업로드 초기화
    const initRes = await fetch(`${this.baseUrl}/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source_info: { source: "FILE_UPLOAD" },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      return { success: false, error: `TikTok 업로드 초기화 실패: ${err}` };
    }

    const initData = await initRes.json() as {
      data: { publish_id: string; upload_url: string };
    };

    // 2단계: 영상 파일 업로드 (로컬 파일 경로에서 읽기)
    const fs = await import("fs/promises");
    const path = await import("path");
    const videoPath = path.join(process.cwd(), "public", content.videoUrl);
    const videoBuffer = await fs.readFile(videoPath);

    const uploadRes = await fetch(initData.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      return { success: false, error: "TikTok 영상 업로드 실패" };
    }

    // 3단계: 발행 완료
    const publishRes = await fetch(`${this.baseUrl}/post/publish/inbox/video/publish/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        publish_id: initData.data.publish_id,
        post_info: {
          title: content.title,
          description: content.description ?? "",
          privacy_level: "PUBLIC_TO_EVERYONE",
        },
      }),
    });

    if (!publishRes.ok) {
      const err = await publishRes.text();
      return { success: false, error: `TikTok 발행 실패: ${err}` };
    }

    return { success: true };
  }

  async getComments(_account: SocialAccount, _postId: string): Promise<Comment[]> { return []; }
  async replyToComment(_account: SocialAccount, _commentId: string, _text: string): Promise<void> {}
  async getMessages(_account: SocialAccount): Promise<DirectMessage[]> { return []; }
  async sendMessage(_account: SocialAccount, _userId: string, _text: string): Promise<void> {}

  async getPostAnalytics(account: SocialAccount, postId: string): Promise<AnalyticsData> {
    const token = decrypt(account.encryptedAccessToken);
    const res = await fetch(
      `${this.baseUrl}/video/query/?fields=id,statistics&filters={"video_ids":["${postId}"]}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };

    const data = await res.json() as {
      data: { videos: Array<{ statistics: { play_count: number; like_count: number; comment_count: number; share_count: number } }> };
    };
    const stats = data.data.videos[0]?.statistics;
    if (!stats) return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };

    return {
      impressions: stats.play_count,
      reach: stats.play_count,
      engagement: stats.like_count + stats.comment_count + stats.share_count,
      clicks: 0,
      comments: stats.comment_count,
      shares: stats.share_count,
      saves: 0,
      likes: stats.like_count,
    };
  }

  async getAccountAnalytics(_account: SocialAccount, dateRange: DateRange): Promise<AccountAnalytics> {
    return { platform: "tiktok", dateRange, totalImpressions: 0, totalReach: 0, totalEngagement: 0, followerGrowth: 0, topPosts: [] };
  }
}
```

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

```bash
git add src/adapters/tiktok.adapter.ts
git commit -m "feat: TikTok OAuth 2.0 PKCE + 영상 발행 구현"
```

---

### Task C4: YouTube 어댑터

**Files:**
- Modify: `src/adapters/youtube.adapter.ts` (전면 교체)

- [ ] **Step 1: youtube.adapter.ts 전면 교체**

```typescript
// src/adapters/youtube.adapter.ts
import type { PlatformAdapter } from "./platform.adapter";
import type {
  PlatformType, TokenResult, ProfileData, PublishResult,
  AnalyticsData, AccountAnalytics, DateRange, Comment, DirectMessage,
} from "@/types/platform.types";
import type { TextContent, CarouselContent, VideoContent } from "@/types/content.types";
import type { SocialAccount } from "@/generated/prisma/client";
import { AppError, ErrorCode } from "@/lib/error";
import { decrypt } from "@/lib/encryption";
import { getPlatformOAuthConfig } from "@/config/platforms.config";

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "youtube";

  getAuthUrl(state?: string, _codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("youtube");
    if (!config?.clientId) throw new AppError("YouTube OAuth가 설정되지 않았습니다.", ErrorCode.OAUTH_FAILED, 500);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
      response_type: "code",
      scope: config.scopes.join(" "),
      access_type: "offline",  // refresh_token 발급
      prompt: "consent",       // 매번 refresh_token 강제 재발급
      ...(state ? { state } : {}),
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeToken(code: string, _codeVerifier?: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("youtube");
    if (!config) throw new AppError("YouTube 설정 없음", ErrorCode.OAUTH_FAILED);

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new AppError(`YouTube 토큰 교환 실패: ${err}`, ErrorCode.OAUTH_FAILED);
    }

    const data = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("youtube");
    if (!config) throw new AppError("YouTube 설정 없음", ErrorCode.OAUTH_FAILED);

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new AppError("YouTube 토큰 갱신 실패", ErrorCode.TOKEN_EXPIRED);
    const data = await res.json() as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      refreshToken,  // refresh_token은 만료 전까지 재사용
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new AppError("YouTube 채널 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      items: Array<{
        id: string;
        snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
      }>;
    };
    const channel = data.items[0];
    if (!channel) throw new AppError("YouTube 채널 없음", ErrorCode.OAUTH_FAILED);

    return {
      platformUserId: channel.id,
      username: channel.snippet.customUrl ?? channel.id,
      displayName: channel.snippet.title,
      profileImageUrl: channel.snippet.thumbnails?.default?.url,
    };
  }

  // YouTube는 텍스트 전용 게시물 미지원 (영상 필수)
  async publishText(_account: SocialAccount, _content: TextContent): Promise<PublishResult> {
    return { success: false, error: "YouTube는 텍스트 전용 게시물을 지원하지 않습니다." };
  }

  async publishCarousel(_account: SocialAccount, _content: CarouselContent): Promise<PublishResult> {
    return { success: false, error: "YouTube는 카드뉴스를 지원하지 않습니다." };
  }

  // YouTube 영상 업로드 (재개 가능한 업로드 API)
  async publishVideo(account: SocialAccount, content: VideoContent): Promise<PublishResult> {
    const token = decrypt(account.encryptedAccessToken);

    // 1단계: 재개 가능한 업로드 세션 시작
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify({
          snippet: {
            title: content.title,
            description: content.description ?? "",
            tags: content.hashtags ?? [],
          },
          status: {
            privacyStatus: "public",
          },
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      return { success: false, error: `YouTube 업로드 초기화 실패: ${err}` };
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) return { success: false, error: "YouTube: 업로드 URL 없음" };

    // 2단계: 영상 파일 업로드
    const fs = await import("fs/promises");
    const path = await import("path");
    const videoPath = path.join(process.cwd(), "public", content.videoUrl);
    const videoBuffer = await fs.readFile(videoPath);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      return { success: false, error: "YouTube 영상 업로드 실패" };
    }

    const data = await uploadRes.json() as { id: string };
    return {
      success: true,
      platformPostId: data.id,
      url: `https://www.youtube.com/watch?v=${data.id}`,
    };
  }

  async getComments(_account: SocialAccount, _postId: string): Promise<Comment[]> { return []; }
  async replyToComment(_account: SocialAccount, _commentId: string, _text: string): Promise<void> {}
  async getMessages(_account: SocialAccount): Promise<DirectMessage[]> { return []; }
  async sendMessage(_account: SocialAccount, _userId: string, _text: string): Promise<void> {}

  async getPostAnalytics(account: SocialAccount, postId: string): Promise<AnalyticsData> {
    const token = decrypt(account.encryptedAccessToken);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${postId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };

    const data = await res.json() as {
      items: Array<{
        statistics: {
          viewCount: string; likeCount: string; commentCount: string; favoriteCount: string;
        };
      }>;
    };
    const stats = data.items[0]?.statistics;
    if (!stats) return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };

    return {
      impressions: parseInt(stats.viewCount),
      reach: parseInt(stats.viewCount),
      engagement: parseInt(stats.likeCount) + parseInt(stats.commentCount),
      clicks: 0,
      comments: parseInt(stats.commentCount),
      shares: 0,
      saves: parseInt(stats.favoriteCount),
      likes: parseInt(stats.likeCount),
    };
  }

  async getAccountAnalytics(_account: SocialAccount, dateRange: DateRange): Promise<AccountAnalytics> {
    return { platform: "youtube", dateRange, totalImpressions: 0, totalReach: 0, totalEngagement: 0, followerGrowth: 0, topPosts: [] };
  }
}
```

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

```bash
cd d:/Dev/social && npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10
```

```bash
git add src/adapters/youtube.adapter.ts
git commit -m "feat: YouTube OAuth 2.0 + 영상 업로드 구현"
```

---

## 최종 검증

- [ ] **전체 빌드 확인**

```bash
cd d:/Dev/social && npm run build 2>&1 | tail -20
```
Expected:
```
✓ Compiled successfully
✓ Generating static pages (N/N)
Route (app)
...모든 라우트 표시
```

- [ ] **신규 라우트 확인**

빌드 출력에서 다음 라우트들이 존재하는지 확인:
```
ƒ /api/content/generate/carousel
ƒ /api/content/generate/blog
ƒ /api/content/generate/bulk
ƒ /api/content/generate/repurpose
○ /content/carousel
○ /content/blog
○ /content/bulk
○ /content/repurpose
```

- [ ] **개발 서버 실행 + 수동 테스트**

```bash
cd d:/Dev/social && npm run dev
```

브라우저에서 순서대로 확인:
1. `/content/carousel` → 주제 입력 → "카드뉴스 생성" (이미지 OFF) → 편집 탭 → 미리보기 탭
2. `/content/blog` → 주제 입력 → 블로그 생성 → 결과 확인
3. `/content/bulk` → 테마 입력 → 기획 시작 → 아이디어 카드 표시 → 클릭으로 해당 페이지 이동
4. `/content/repurpose` → 텍스트 붙여넣기 → 형식 선택 → 리퍼포징

- [ ] **최종 커밋**

```bash
git add -A
git commit -m "feat: Phase 2 완료 — 카드뉴스/블로그/대량기획/리퍼포징 + TikTok/YouTube/X 어댑터"
```

---

## 구현 후 주의사항

| 항목 | 내용 |
|------|------|
| DALL-E 이미지 비용 | dall-e-3 1장 = $0.04, 카드뉴스 5장 = $0.20. 이미지 생성은 토글로 선택 가능 |
| FAL_KEY 미설정 | FLUX 선택 시 에러 발생. `.env`에 `FAL_KEY` 또는 `IMAGE_PROVIDER=dalle` 설정 |
| TikTok API 심사 | Content Posting API는 비즈니스 계정 심사 필요. 개발 중에는 sandbox 계정 사용 |
| X API 무료 플랜 | 월 500 트윗 쓰기 제한. 읽기(타임라인/DM) 불가 |
| YouTube 할당량 | YouTube Data API v3 하루 10,000 단위. 영상 업로드 = 1600 단위 |
| public/uploads 용량 | 이미지 누적 시 디스크 관리 필요. 정기적으로 오래된 파일 정리 권장 |
