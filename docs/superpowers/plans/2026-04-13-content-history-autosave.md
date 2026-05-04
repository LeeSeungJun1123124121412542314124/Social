# Content History & Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘텐츠 생성 직후 DB에 draft 자동저장하고, 동일 페이지 하단에 최근 5개 히스토리 패널을 표시하여 페이지 이탈/새로고침으로 인한 생성 결과 유실을 방지한다.

**Architecture:** 생성 완료 즉시 `POST /api/content`를 자동 호출하여 draft로 저장한다. `useContentHistory(type)` 훅이 해당 타입의 최근 5개를 조회하고, `ContentHistoryPanel` 컴포넌트가 하단 패널로 렌더링한다. 히스토리 항목 클릭 시 `contentText`/`contentData` JSON을 역직렬화하여 결과 state를 복원한다. 5개 페이지(text, blog, carousel, bulk, repurpose)에 동일 패턴으로 적용한다.

**Tech Stack:** Next.js 16.2 App Router, React 19.2 (`"use client"`), TypeScript strict, Prisma 7.6 + PostgreSQL, Zod 4.3, Tailwind 4, lucide-react

---

## File Map

| 역할 | 파일 | 생성/수정 |
|------|------|-----------|
| DB 조회 — type+limit 필터 | `src/services/content.service.ts` | 수정 |
| API — type/limit 쿼리 파라미터 | `src/app/api/content/route.ts` | 수정 |
| 훅 — 히스토리 조회 + 자동저장 | `src/hooks/useContentHistory.ts` | **신규** |
| UI — 히스토리 패널 컴포넌트 | `src/components/content/ContentHistoryPanel.tsx` | **신규** |
| 텍스트 생성 페이지 | `src/app/content/text/page.tsx` | 수정 |
| 블로그 생성 페이지 | `src/app/content/blog/page.tsx` | 수정 |
| 카드뉴스 생성 페이지 | `src/app/content/carousel/page.tsx` | 수정 |
| 대량기획 생성 페이지 | `src/app/content/bulk/page.tsx` | 수정 |
| 리퍼포징 생성 페이지 | `src/app/content/repurpose/page.tsx` | 수정 |

---

## Task 1: content.service.ts — type + limit 필터

**Files:**
- Modify: `src/services/content.service.ts`

- [ ] **Step 1: `getRecentByType` 메서드 추가**

`contentService` 객체에 아래 메서드를 추가한다. `getAll` 수정 없이 새 메서드로 분리하여 기존 동작을 보존한다.

```typescript
// src/services/content.service.ts 내 contentService 객체에 추가
// (기존 getAll, getById, create, update, delete, transitionStatus, schedule 유지)

  // 타입별 최근 게시물 조회 (히스토리 패널용)
  async getRecentByType(type: string, limit = 5) {
    return prisma.post.findMany({
      where: { type },
      select: {
        id: true,
        title: true,
        contentText: true,
        contentData: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  },
```

- [ ] **Step 2: API route — type/limit 쿼리 파라미터 추가**

`src/app/api/content/route.ts`의 GET 핸들러를 수정한다.

```typescript
// src/app/api/content/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";
import { contentService } from "@/services/content.service";
import { z } from "zod";

const createContentSchema = z.object({
  type: z.string().min(1),
  title: z.string().max(500).optional(),
  contentText: z.string().optional(),
  contentData: z.string().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  accountIds: z.array(z.string().min(1)).optional(),
});

// 콘텐츠 목록 조회
// ?status=draft → 기존 동작 유지
// ?type=text&limit=5 → 타입별 최근 조회 (히스토리용)
export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  if (type !== undefined) {
    const posts = await contentService.getRecentByType(type, limit ?? 5);
    return successResponse(posts);
  }

  const posts = await contentService.getAll(status);
  return successResponse(posts);
});

export const POST = apiHandler(async (req) => {
  const body = await validateBody(req, createContentSchema);
  const post = await contentService.create(body);
  return successResponse(post, 201);
});
```

- [ ] **Step 3: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
```

Expected: 오류 없음

```bash
git add src/services/content.service.ts src/app/api/content/route.ts
git commit -m "feat: content API — type/limit 쿼리 필터 추가"
```

---

## Task 2: useContentHistory 훅

**Files:**
- Create: `src/hooks/useContentHistory.ts`

- [ ] **Step 1: 훅 파일 생성**

```typescript
// src/hooks/useContentHistory.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export interface HistoryPost {
  id: string;
  title: string | null;
  contentText: string | null;
  contentData: string | null;
  status: string;
  createdAt: string;
}

export interface AutoSavePayload {
  title?: string;
  contentText?: string;
  contentData?: string;
}

/**
 * 콘텐츠 타입별 최근 N개 히스토리를 조회하고 자동저장 기능을 제공하는 훅.
 *
 * @param type  Post.type 값 ("text" | "carousel" | "blog" | "bulk" | "repurpose")
 * @param limit 조회할 최대 개수 (기본 5)
 */
export function useContentHistory(type: string, limit = 5) {
  const [history, setHistory] = useState<HistoryPost[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await window.fetch(`/api/content?type=${encodeURIComponent(type)}&limit=${limit}`);
      const data = await res.json() as { success: boolean; data: HistoryPost[] };
      if (data.success) setHistory(data.data);
    } catch {
      // 히스토리 로드 실패는 UI를 방해하지 않도록 조용히 처리
    } finally {
      setHistoryLoading(false);
    }
  }, [type, limit]);

  // 자동저장 후 히스토리 갱신
  const autoSave = useCallback(
    async (payload: AutoSavePayload): Promise<void> => {
      try {
        await window.fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...payload }),
        });
        // 저장 후 히스토리 즉시 갱신
        await refreshHistory();
      } catch {
        // 자동저장 실패는 조용히 처리 (사용자 작업 방해 않음)
      }
    },
    [type, refreshHistory]
  );

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  return { history, historyLoading, refreshHistory, autoSave };
}
```

- [ ] **Step 2: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
```

Expected: 오류 없음

```bash
git add src/hooks/useContentHistory.ts
git commit -m "feat: useContentHistory 훅 — 타입별 히스토리 조회 + 자동저장"
```

---

## Task 3: ContentHistoryPanel 컴포넌트

**Files:**
- Create: `src/components/content/ContentHistoryPanel.tsx`

- [ ] **Step 1: 컴포넌트 파일 생성**

히스토리 패널은 순수 표현 컴포넌트. 데이터는 부모 페이지에서 전달받는다.

```typescript
// src/components/content/ContentHistoryPanel.tsx
"use client";

import type { HistoryPost } from "@/hooks/useContentHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContentHistoryPanelProps {
  history: HistoryPost[];
  loading: boolean;
  onRestore: (post: HistoryPost) => void;
}

function timeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function ContentHistoryPanel({ history, loading, onRestore }: ContentHistoryPanelProps) {
  if (!loading && history.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>이전 생성 기록 (최근 {history.length}개)</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((post) => (
            <li
              key={post.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {post.title ?? "제목 없음"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timeAgo(post.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-8 gap-1.5 text-xs"
                onClick={() => onRestore(post)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                복원
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
```

Expected: 오류 없음

```bash
git add src/components/content/ContentHistoryPanel.tsx
git commit -m "feat: ContentHistoryPanel 컴포넌트 추가"
```

---

## Task 4: 텍스트 생성 페이지 — auto-save + history

**Files:**
- Modify: `src/app/content/text/page.tsx`

**직렬화 규칙:**
- `contentText` = `result.text`
- `title` = topic (첫 50자)
- `contentData` = `JSON.stringify({ platform: result.platform, hashtags: result.hashtags })`

**복원 규칙:**
- `result.text` ← `post.contentText`
- `result.platform` ← `JSON.parse(post.contentData).platform`
- `result.hashtags` ← `JSON.parse(post.contentData).hashtags`
- `result.characterCount` ← `post.contentText?.length ?? 0`

- [ ] **Step 1: import 추가 및 훅/컴포넌트 연결**

`TextContentPage` 컴포넌트 상단에 import 추가:

```typescript
import { useContentHistory } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import type { HistoryPost } from "@/hooks/useContentHistory";
```

- [ ] **Step 2: 훅 사용 및 handleGenerate에 autoSave 추가**

컴포넌트 body 내에 훅을 호출하고, `handleGenerate` 함수를 수정한다:

```typescript
// 기존 코드에 추가
const { history, historyLoading, autoSave } = useContentHistory("text");

// handleGenerate 수정 — 생성 성공 시 자동저장 추가
const handleGenerate = async () => {
  if (!topic.trim()) {
    toast.error("주제를 입력해주세요.");
    return;
  }
  const generated = await generate({ topic, platform, tone });
  if (generated) {
    setResult(generated);
    toast.success("콘텐츠가 생성되었습니다.");
    // 자동저장 (실패해도 toast 없음 — 조용히 처리)
    void autoSave({
      title: topic.substring(0, 50),
      contentText: generated.text,
      contentData: JSON.stringify({
        platform: generated.platform,
        hashtags: generated.hashtags,
      }),
    });
  } else {
    toast.error("생성에 실패했습니다. API 키를 확인하세요.");
  }
};
```

- [ ] **Step 3: handleRestore 추가 + 저장 버튼 제거**

기존 `handleSave` 함수를 제거하고 `handleRestore`를 추가한다:

```typescript
// handleSave 함수 제거 (autoSave로 대체됨)

// 히스토리 복원
const handleRestore = (post: HistoryPost) => {
  try {
    const meta = post.contentData ? (JSON.parse(post.contentData) as { platform?: string; hashtags?: string[] }) : {};
    setResult({
      text: post.contentText ?? "",
      platform: (meta.platform ?? platform) as import("@/types/platform.types").PlatformType,
      characterCount: post.contentText?.length ?? 0,
      hashtags: meta.hashtags,
    });
    toast.success("이전 결과를 복원했습니다.");
  } catch {
    toast.error("복원에 실패했습니다.");
  }
};
```

- [ ] **Step 4: JSX에서 저장 버튼 제거 + 히스토리 패널 추가**

JSX에서:
1. Save 아이콘 import 제거 (사용 안 함)
2. `handleSave` 호출하는 `<Button>` 제거
3. 컴포넌트 최하단(return의 div 닫기 전)에 추가:

```tsx
{/* 히스토리 패널 */}
<ContentHistoryPanel
  history={history}
  loading={historyLoading}
  onRestore={handleRestore}
/>
```

- [ ] **Step 5: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
```

Expected: 오류 없음

```bash
git add src/app/content/text/page.tsx
git commit -m "feat: 텍스트 생성 — auto-save + 히스토리 패널"
```

---

## Task 5: 블로그 생성 페이지 — auto-save + history

**Files:**
- Modify: `src/app/content/blog/page.tsx`

**직렬화 규칙:**
- `title` = `result.title`
- `contentText` = `result.body`
- `contentData` = `JSON.stringify({ excerpt: result.excerpt, tags: result.tags, wordCount: result.wordCount })`

**복원 규칙:**
- `result.title` ← `post.title ?? ""`
- `result.body` ← `post.contentText ?? ""`
- `result.excerpt`, `result.tags`, `result.wordCount` ← `JSON.parse(post.contentData)`

- [ ] **Step 1: import 추가**

```typescript
import { useContentHistory } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import type { HistoryPost } from "@/hooks/useContentHistory";
```

- [ ] **Step 2: 훅 호출 + handleGenerate 수정**

`BlogContent` 함수 body 내:

```typescript
const { history, historyLoading, autoSave } = useContentHistory("blog");

// handleGenerate 수정
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
  } else {
    toast.error("생성에 실패했습니다.");
  }
};
```

- [ ] **Step 3: handleSave 제거 + handleRestore 추가**

기존 `handleSave` 함수 제거. 추가:

```typescript
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
```

- [ ] **Step 4: JSX — Save 버튼 제거 + 히스토리 패널 추가**

JSX에서 Save 버튼 제거. 최하단에 추가:

```tsx
<ContentHistoryPanel
  history={history}
  loading={historyLoading}
  onRestore={handleRestore}
/>
```

- [ ] **Step 5: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
git add src/app/content/blog/page.tsx
git commit -m "feat: 블로그 생성 — auto-save + 히스토리 패널"
```

---

## Task 6: 카드뉴스 생성 페이지 — auto-save + history

**Files:**
- Modify: `src/app/content/carousel/page.tsx`

**직렬화 규칙:**
- `title` = topic (첫 50자)
- `contentText` = `result.caption`
- `contentData` = `JSON.stringify({ slides: result.slides })`

**복원 규칙:**
- `result.caption` ← `post.contentText ?? ""`
- `result.slides` ← `JSON.parse(post.contentData).slides`

- [ ] **Step 1: import 추가**

```typescript
import { useContentHistory } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import type { HistoryPost } from "@/hooks/useContentHistory";
```

- [ ] **Step 2: 훅 호출 + handleGenerate 수정**

`CarouselContent` 함수 body 내:

```typescript
const { history, historyLoading, autoSave } = useContentHistory("carousel");

// 기존 handleGenerate의 setResult(res) 이후에 추가:
void autoSave({
  title: topic.substring(0, 50),
  contentText: res.caption,
  contentData: JSON.stringify({ slides: res.slides }),
});
```

- [ ] **Step 3: handleRestore 추가 (기존 저장 버튼은 유지)**

카드뉴스는 별도 Save 버튼이 있는지 확인 후 제거 또는 유지. 현재 carousel/page.tsx는 Save 버튼이 있으면 제거.

```typescript
const handleRestore = (post: HistoryPost) => {
  try {
    const meta = post.contentData
      ? (JSON.parse(post.contentData) as { slides?: import("@/types/content.types").CarouselSlide[] })
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
```

- [ ] **Step 4: JSX — Save 버튼 제거 + 히스토리 패널 추가**

최하단(닫히는 div 전)에 추가:

```tsx
<ContentHistoryPanel
  history={history}
  loading={historyLoading}
  onRestore={handleRestore}
/>
```

- [ ] **Step 5: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
git add src/app/content/carousel/page.tsx
git commit -m "feat: 카드뉴스 생성 — auto-save + 히스토리 패널"
```

---

## Task 7: 대량기획 생성 페이지 — auto-save + history

**Files:**
- Modify: `src/app/content/bulk/page.tsx`

**직렬화 규칙:**
- `title` = theme (첫 50자)
- `contentData` = `JSON.stringify(result)` — BulkPlan 전체

**복원 규칙:**
- `result` ← `JSON.parse(post.contentData)` as BulkPlan

대량기획은 `contentText`가 없고, `contentData`에 전체 계획을 저장한다.

- [ ] **Step 1: import 추가**

```typescript
import { useContentHistory } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import type { HistoryPost } from "@/hooks/useContentHistory";
```

- [ ] **Step 2: 훅 호출 + handleGenerate 수정**

```typescript
const { history, historyLoading, autoSave } = useContentHistory("bulk");

// handleGenerate의 setResult(res) 이후 추가:
void autoSave({
  title: theme.substring(0, 50),
  contentData: JSON.stringify(res),
});
```

- [ ] **Step 3: handleRestore 추가**

```typescript
const handleRestore = (post: HistoryPost) => {
  try {
    const restored = JSON.parse(post.contentData ?? "{}") as BulkPlan;
    if (!restored.ideas) throw new Error("잘못된 데이터");
    setResult(restored);
    toast.success("이전 결과를 복원했습니다.");
  } catch {
    toast.error("복원에 실패했습니다.");
  }
};
```

- [ ] **Step 4: JSX — 히스토리 패널 추가**

대량기획 페이지는 기존 Save 버튼 없음. 최하단에 추가:

```tsx
<ContentHistoryPanel
  history={history}
  loading={historyLoading}
  onRestore={handleRestore}
/>
```

- [ ] **Step 5: tsc 통과 확인 후 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
git add src/app/content/bulk/page.tsx
git commit -m "feat: 대량기획 생성 — auto-save + 히스토리 패널"
```

---

## Task 8: 리퍼포징 생성 페이지 — auto-save + history

**Files:**
- Modify: `src/app/content/repurpose/page.tsx`

**직렬화 규칙:**
- `title` = sourceContent 첫 50자
- `contentData` = `JSON.stringify(results)` — RepurposeResult[] 전체

**복원 규칙:**
- `results` ← `JSON.parse(post.contentData)` as RepurposeResult[]

리퍼포징은 결과가 배열(`results`)이므로 contentData에 전체 배열을 저장한다.
기존에는 결과별로 각각 Save가 가능했으나, auto-save는 전체 결과를 하나의 레코드로 저장한다.

- [ ] **Step 1: import 추가**

```typescript
import { useContentHistory } from "@/hooks/useContentHistory";
import { ContentHistoryPanel } from "@/components/content/ContentHistoryPanel";
import type { HistoryPost } from "@/hooks/useContentHistory";
```

- [ ] **Step 2: 훅 호출 + handleRepurpose 수정**

```typescript
const { history, historyLoading, autoSave } = useContentHistory("repurpose");

// handleRepurpose의 setResults(res) 이후 추가:
void autoSave({
  title: sourceContent.substring(0, 50),
  contentData: JSON.stringify(res),
});
```

- [ ] **Step 3: 개별 Save 버튼 제거 + handleRestore 추가**

기존 `handleSave(result: RepurposeResult)` 함수 및 호출하는 버튼 제거.

```typescript
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
```

- [ ] **Step 4: JSX — 히스토리 패널 추가**

최하단에 추가:

```tsx
<ContentHistoryPanel
  history={history}
  loading={historyLoading}
  onRestore={handleRestore}
/>
```

- [ ] **Step 5: tsc 통과 + 전체 테스트 + 커밋**

```bash
cd d:/Dev/social/.worktrees/refactor-gap-recovery
npx tsc --noEmit
npm test
git add src/app/content/repurpose/page.tsx
git commit -m "feat: 리퍼포징 생성 — auto-save + 히스토리 패널"
```

---

## 전체 검증 체크리스트

- [ ] `GET /api/content?type=text&limit=5` → text 타입 최근 5개 반환
- [ ] 텍스트 생성 → DB에 type="text" draft 레코드 생성 확인 (`/admin/health` JobRun 대신 직접 DB)
- [ ] 페이지 새로고침 후 히스토리 패널에 이전 결과 표시
- [ ] 히스토리 "복원" 클릭 → 편집 영역에 결과 로드
- [ ] 연속 3번 생성 → 히스토리에 최신 3개만 표시 (5개 미만 시)
- [ ] 5개 초과 시 최신 5개만 유지
- [ ] `npm test` 29개 통과 (기존 스모크 테스트 회귀 없음)
- [ ] `npx tsc --noEmit` 통과
