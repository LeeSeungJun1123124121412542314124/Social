# Phase 3: Engage + Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 댓글/DM 수집·AI 자동응답 관리 시스템과 플랫폼 선택형 성과 분석 대시보드를 구현한다.

**Architecture:** 스케줄러(engage-poll: 15분, analytics-sync: 6시간)가 플랫폼에서 데이터를 수집하고, engage.service / analytics.service가 비즈니스 로직을 처리한다. X(Twitter)는 API 한도로 인해 폴링 대상에서 제외하고 수동 갱신만 지원한다. DB는 SQLite → PostgreSQL로 전환한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 + PostgreSQL 18, Recharts, shadcn/ui (Base UI 기반), node-cron

---

## 파일 구조 맵

```
# 선행: PostgreSQL 마이그레이션
.env                                          ← DATABASE_URL 추가
prisma/schema.prisma                          ← provider 변경 + 모델 추가
src/lib/prisma.ts                             ← LibSQL 어댑터 제거

# 서비스 (신규)
src/services/engage.service.ts               ← 댓글/DM 수집·AI초안·발송·규칙
src/services/analytics.service.ts            ← 성과 수집·집계·AI리포트

# API Routes (신규)
src/app/api/engage/route.ts                  ← GET 목록
src/app/api/engage/[id]/route.ts             ← PATCH 수정
src/app/api/engage/[id]/send/route.ts        ← POST 발송
src/app/api/engage/poll/route.ts             ← POST 수동갱신(X 전용)
src/app/api/engage/rules/route.ts            ← GET 목록 / POST 생성
src/app/api/engage/rules/[id]/route.ts       ← PATCH 수정 / DELETE 삭제
src/app/api/analytics/route.ts               ← GET 대시보드 데이터
src/app/api/analytics/sync/route.ts          ← POST 수동 동기화
src/app/api/analytics/report/route.ts        ← POST AI 리포트 생성

# UI (교체)
src/app/engage/page.tsx                      ← 이메일형 2-패널 UI
src/app/analytics/page.tsx                   ← 플랫폼 선택형 대시보드

# 스케줄러 (stub → 활성화)
src/scheduler/jobs/engage-poll.job.ts
src/scheduler/jobs/analytics-sync.job.ts
```

---

## Task A0: PostgreSQL 마이그레이션

**Files:**
- Modify: `.env`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/prisma.ts`

- [ ] **Step 1: DATABASE_URL을 .env에 추가**

`.env` 파일에 아래 줄을 추가 (없으면 파일 생성):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/Social"
```

- [ ] **Step 2: prisma/schema.prisma datasource 변경**

기존:
```prisma
datasource db {
  provider = "sqlite"
}
```

변경:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 3: src/lib/prisma.ts — LibSQL 어댑터 제거**

파일 전체를 아래로 교체:
```typescript
import { PrismaClient } from "@/generated/prisma/client";

// 개발 환경에서 HMR로 인한 중복 인스턴스 방지
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: @prisma/adapter-libsql 의존성 제거**

```bash
cd d:/Dev/social && npm uninstall @prisma/adapter-libsql
```

Expected: `removed 1 package`

- [ ] **Step 5: 초기 마이그레이션 실행**

```bash
cd d:/Dev/social && npx prisma migrate dev --name init
```

Expected: `✔  Generated Prisma Client` 및 테이블 생성 완료

- [ ] **Step 6: 타입 체크**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음 (에러 없음)

- [ ] **Step 7: 커밋**

```bash
cd d:/Dev/social && git add .env prisma/schema.prisma prisma/migrations/ src/lib/prisma.ts package.json package-lock.json && git commit -m "feat: SQLite → PostgreSQL 마이그레이션"
```

---

## Task A1: 스키마 확장 (EngageItem + AccountAnalyticsSnapshot + autoSend)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: EngageItem 모델을 schema.prisma 끝에 추가**

```prisma
// 댓글/DM 수신함 항목
model EngageItem {
  id             String    @id @default(cuid())
  platform       String    // instagram | threads | tiktok | youtube | x
  triggerType    String    // comment | dm
  platformItemId String    // 플랫폼 고유 ID (중복 수집 방지)
  platformPostId String?   // 댓글의 원본 게시물 ID
  authorId       String?
  authorName     String?
  text           String
  aiDraft        String?   // AI 생성 응답 초안
  flaggedSales   Boolean   @default(false)
  status         String    @default("pending") // pending | replied | ignored
  autoSent       Boolean   @default(false)
  repliedAt      DateTime?
  fetchedAt      DateTime  @default(now())

  @@unique([platform, platformItemId])
  @@index([platform, status])
  @@index([flaggedSales])
  @@index([fetchedAt])
}

// 계정 레벨 일별 성과 스냅샷 (추이 차트용)
model AccountAnalyticsSnapshot {
  id           String   @id @default(cuid())
  accountId    String
  platform     String
  followers    Int      @default(0)
  impressions  Int      @default(0)
  reach        Int      @default(0)
  engagement   Int      @default(0)
  snapshotDate DateTime // 저장 전 자정(00:00:00.000Z)으로 정규화

  @@unique([accountId, snapshotDate])
  @@index([platform, snapshotDate])
}
```

- [ ] **Step 2: AutoReplyRule에 autoSend 필드 추가**

기존 `AutoReplyRule` 모델에서 `isActive` 줄 바로 위에 추가:
```prisma
  autoSend      Boolean  @default(false)  // 규칙 매칭 시 자동 발송 여부
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
cd d:/Dev/social && npx prisma migrate dev --name phase3-engage-analytics
```

Expected: `✔  Generated Prisma Client` 및 세 변경사항 적용

- [ ] **Step 4: 타입 체크**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음

- [ ] **Step 5: 커밋**

```bash
cd d:/Dev/social && git add prisma/schema.prisma prisma/migrations/ src/generated/ && git commit -m "feat: EngageItem, AccountAnalyticsSnapshot 스키마 추가"
```

---

## Task B1: engage.service.ts

**Files:**
- Create: `src/services/engage.service.ts`

- [ ] **Step 1: engage.service.ts 생성**

```typescript
// src/services/engage.service.ts
import { prisma } from "@/lib/prisma";
import { getPlatformAdapter } from "@/adapters";
import { getLLMProvider } from "@/ai";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/encryption";
import { AppError, ErrorCode } from "@/lib/error";
import type { SocialAccount, AutoReplyRule, EngageItem } from "@/generated/prisma/client";

// 폴링 제외 플랫폼 (API 한도 문제)
const POLL_EXCLUDED_PLATFORMS = ["x"];

// 세일즈 키워드 기본값 (AutoReplyRule.salesKeywords가 없을 때)
const DEFAULT_SALES_KEYWORDS = ["예약", "가격", "비용", "상담", "문의", "얼마"];

export const engageService = {
  /**
   * 특정 계정의 댓글/DM을 수집하고 AI 초안을 생성한다.
   * 에러 발생 시 로그만 남기고 계속 진행 (폴링 중단 방지).
   */
  async pollAndProcess(account: SocialAccount): Promise<void> {
    if (POLL_EXCLUDED_PLATFORMS.includes(account.platform)) return;

    try {
      const adapter = getPlatformAdapter(account.platform);
      const accessToken = decrypt(account.encryptedAccessToken);

      // 최근 7일 게시물의 댓글 수집
      const recentLogs = await prisma.publishLog.findMany({
        where: {
          accountId: account.id,
          success: true,
          attemptedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          platformPostId: { not: null },
        },
        select: { platformPostId: true },
        distinct: ["platformPostId"],
      });

      const newItems: Array<{
        platform: string;
        triggerType: string;
        platformItemId: string;
        platformPostId?: string;
        authorId?: string;
        authorName?: string;
        text: string;
      }> = [];

      // 댓글 수집
      for (const log of recentLogs) {
        if (!log.platformPostId) continue;
        try {
          const comments = await adapter.getComments(account, log.platformPostId);
          for (const c of comments) {
            newItems.push({
              platform: account.platform,
              triggerType: "comment",
              platformItemId: c.id,
              platformPostId: log.platformPostId,
              authorId: c.authorId,
              authorName: c.authorName,
              text: c.text,
            });
          }
        } catch (e) {
          logger.warn(`댓글 수집 실패 (${account.platform}/${log.platformPostId}):`, e);
        }
      }

      // DM 수집
      try {
        const messages = await adapter.getMessages(account);
        for (const m of messages) {
          if (m.isFromMe) continue;
          newItems.push({
            platform: account.platform,
            triggerType: "dm",
            platformItemId: m.id,
            authorId: m.senderId,
            authorName: m.senderName,
            text: m.text,
          });
        }
      } catch (e) {
        logger.warn(`DM 수집 실패 (${account.platform}):`, e);
      }

      // 자동응답 규칙 로드
      const rules = await prisma.autoReplyRule.findMany({
        where: { platform: account.platform, isActive: true },
      });

      // 신규 항목만 처리 (@@unique로 upsert 시 기존은 스킵)
      for (const item of newItems) {
        try {
          await this._processItem(item, rules, account, accessToken);
        } catch (e) {
          logger.warn(`항목 처리 실패 (${item.platformItemId}):`, e);
        }
      }
    } catch (e) {
      logger.error(`pollAndProcess 실패 (${account.platform}/${account.id}):`, e);
    }
  },

  async _processItem(
    raw: {
      platform: string; triggerType: string; platformItemId: string;
      platformPostId?: string; authorId?: string; authorName?: string; text: string;
    },
    rules: AutoReplyRule[],
    account: SocialAccount,
    _accessToken: string,
  ): Promise<void> {
    // 이미 존재하면 스킵
    const exists = await prisma.engageItem.findUnique({
      where: { platform_platformItemId: { platform: raw.platform, platformItemId: raw.platformItemId } },
    });
    if (exists) return;

    // 세일즈 키워드 감지
    const allSalesKw = rules.flatMap(r =>
      r.salesKeywords ? (JSON.parse(r.salesKeywords) as string[]) : DEFAULT_SALES_KEYWORDS
    );
    const flaggedSales = allSalesKw.some(kw => raw.text.includes(kw));

    // AI 초안 생성
    let aiDraft: string | null = null;
    try {
      const llm = getLLMProvider();
      aiDraft = await llm.generateText(
        `당신은 병원 SNS 관리자입니다. 아래 ${raw.triggerType === "comment" ? "댓글" : "DM"}에 친절하고 전문적인 한국어로 80자 이내로 답변해주세요.\n\n원문: "${raw.text}"\n\n답변:`,
        { maxTokens: 150 }
      );
    } catch (e) {
      logger.warn("AI 초안 생성 실패:", e);
    }

    // DB 저장
    const created = await prisma.engageItem.create({
      data: {
        platform: raw.platform,
        triggerType: raw.triggerType,
        platformItemId: raw.platformItemId,
        platformPostId: raw.platformPostId,
        authorId: raw.authorId,
        authorName: raw.authorName,
        text: raw.text,
        aiDraft,
        flaggedSales,
      },
    });

    // 세일즈 감지 시 알림 생성
    if (flaggedSales) {
      await prisma.notification.create({
        data: {
          type: "sales_lead",
          title: "세일즈 문의 감지",
          message: `[${raw.platform}] ${raw.authorName ?? "익명"}: "${raw.text.slice(0, 50)}..."`,
          metadata: JSON.stringify({ engageItemId: created.id }),
        },
      });
    }

    // autoSend 규칙 확인
    const matchedAutoRule = rules.find(r => {
      if (!r.autoSend) return false;
      if (r.triggerType !== raw.triggerType) return false;
      if (!r.keywords) return true; // 키워드 없으면 모두 매칭
      const kws = JSON.parse(r.keywords) as string[];
      return kws.some(kw => raw.text.includes(kw));
    });

    if (matchedAutoRule && aiDraft) {
      try {
        const adapter = getPlatformAdapter(raw.platform);
        if (raw.triggerType === "comment" && raw.platformPostId) {
          await adapter.replyToComment(account, raw.platformItemId, aiDraft);
        } else if (raw.triggerType === "dm" && raw.authorId) {
          await adapter.sendMessage(account, raw.authorId, aiDraft);
        }
        await prisma.engageItem.update({
          where: { id: created.id },
          data: { status: "replied", autoSent: true, repliedAt: new Date() },
        });
      } catch (e) {
        logger.warn("자동 발송 실패:", e);
      }
    }
  },

  async listItems(filters: {
    platform?: string;
    status?: string;
    triggerType?: string;
    page?: number;
  }): Promise<{ items: EngageItem[]; total: number }> {
    const page = filters.page ?? 1;
    const take = 30;
    const skip = (page - 1) * take;

    const where = {
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.status === "sales" ? { flaggedSales: true, status: "pending" } : filters.status ? { status: filters.status } : {}),
      ...(filters.triggerType ? { triggerType: filters.triggerType } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.engageItem.findMany({ where, orderBy: { fetchedAt: "desc" }, take, skip }),
      prisma.engageItem.count({ where }),
    ]);
    return { items, total };
  },

  async sendReply(id: string, text: string): Promise<void> {
    const item = await prisma.engageItem.findUnique({ where: { id } });
    if (!item) throw new AppError("항목을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404);
    if (item.status === "replied") throw new AppError("이미 답변된 항목입니다.", ErrorCode.VALIDATION_ERROR, 400);

    const account = await prisma.socialAccount.findFirst({
      where: { platform: item.platform, isActive: true },
    });
    if (!account) throw new AppError("연동된 계정이 없습니다.", ErrorCode.ACCOUNT_NOT_FOUND, 404);

    const adapter = getPlatformAdapter(item.platform);
    if (item.triggerType === "comment" && item.platformPostId) {
      await adapter.replyToComment(account, item.platformItemId, text);
    } else if (item.triggerType === "dm" && item.authorId) {
      await adapter.sendMessage(account, item.authorId, text);
    }

    await prisma.engageItem.update({
      where: { id },
      data: { status: "replied", aiDraft: text, repliedAt: new Date() },
    });
  },

  async updateItem(id: string, patch: { aiDraft?: string; status?: string }): Promise<EngageItem> {
    return prisma.engageItem.update({ where: { id }, data: patch });
  },

  async pollManual(platform: string): Promise<void> {
    const accounts = await prisma.socialAccount.findMany({
      where: { platform, isActive: true },
    });
    for (const account of accounts) {
      await this.pollAndProcess(account);
    }
  },
};
```

- [ ] **Step 2: 타입 체크**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -30
```

Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
cd d:/Dev/social && git add src/services/engage.service.ts && git commit -m "feat: engage.service 구현 (댓글/DM 수집·AI초안·자동응답)"
```

---

## Task B2: Engage API Routes

**Files:**
- Create: `src/app/api/engage/route.ts`
- Create: `src/app/api/engage/[id]/route.ts`
- Create: `src/app/api/engage/[id]/send/route.ts`
- Create: `src/app/api/engage/poll/route.ts`
- Create: `src/app/api/engage/rules/route.ts`
- Create: `src/app/api/engage/rules/[id]/route.ts`

- [ ] **Step 1: GET /api/engage — 목록 조회**

```typescript
// src/app/api/engage/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const result = await engageService.listItems({
    platform: searchParams.get("platform") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    triggerType: searchParams.get("triggerType") ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
  });
  return successResponse(result);
});
```

- [ ] **Step 2: PATCH /api/engage/[id] — 초안 수정·상태 변경**

```typescript
// src/app/api/engage/[id]/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

export const PATCH = apiHandler(async (req: NextRequest, ctx: unknown) => {
  const { id } = (ctx as { params: { id: string } }).params;
  const body = await req.json() as { aiDraft?: string; status?: string };
  const item = await engageService.updateItem(id, body);
  return successResponse(item);
});
```

- [ ] **Step 3: POST /api/engage/[id]/send — 응답 발송**

```typescript
// src/app/api/engage/[id]/send/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";
import { AppError, ErrorCode } from "@/lib/error";

export const POST = apiHandler(async (req: NextRequest, ctx: unknown) => {
  const { id } = (ctx as { params: { id: string } }).params;
  const body = await req.json() as { text?: string };
  if (!body.text?.trim()) throw new AppError("응답 텍스트가 없습니다.", ErrorCode.VALIDATION_ERROR, 400);
  await engageService.sendReply(id, body.text);
  return successResponse({ ok: true });
});
```

- [ ] **Step 4: POST /api/engage/poll — X 수동갱신**

```typescript
// src/app/api/engage/poll/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json() as { platform?: string };
  const platform = body.platform ?? "x";
  await engageService.pollManual(platform);
  return successResponse({ ok: true });
});
```

- [ ] **Step 5: GET + POST /api/engage/rules**

```typescript
// src/app/api/engage/rules/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AppError, ErrorCode } from "@/lib/error";

export const GET = apiHandler(async () => {
  const rules = await prisma.autoReplyRule.findMany({ orderBy: { createdAt: "desc" } });
  return successResponse(rules);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json() as {
    platform: string;
    triggerType: string;
    keywords?: string[];
    useAI?: boolean;
    templateReply?: string;
    salesKeywords?: string[];
    notifyOnSales?: boolean;
    autoSend?: boolean;
  };
  if (!body.platform || !body.triggerType) {
    throw new AppError("platform, triggerType은 필수입니다.", ErrorCode.VALIDATION_ERROR, 400);
  }
  const rule = await prisma.autoReplyRule.create({
    data: {
      platform: body.platform,
      triggerType: body.triggerType,
      keywords: body.keywords ? JSON.stringify(body.keywords) : null,
      useAI: body.useAI ?? true,
      templateReply: body.templateReply,
      salesKeywords: body.salesKeywords ? JSON.stringify(body.salesKeywords) : null,
      notifyOnSales: body.notifyOnSales ?? true,
      autoSend: body.autoSend ?? false,
    },
  });
  return successResponse(rule, 201);
});
```

- [ ] **Step 6: PATCH + DELETE /api/engage/rules/[id]**

```typescript
// src/app/api/engage/rules/[id]/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AppError, ErrorCode } from "@/lib/error";

export const PATCH = apiHandler(async (req: NextRequest, ctx: unknown) => {
  const { id } = (ctx as { params: { id: string } }).params;
  const body = await req.json() as Record<string, unknown>;
  // keywords/salesKeywords 배열은 JSON 문자열로 직렬화
  if (Array.isArray(body.keywords)) body.keywords = JSON.stringify(body.keywords);
  if (Array.isArray(body.salesKeywords)) body.salesKeywords = JSON.stringify(body.salesKeywords);
  const rule = await prisma.autoReplyRule.update({ where: { id }, data: body });
  return successResponse(rule);
});

export const DELETE = apiHandler(async (_req: NextRequest, ctx: unknown) => {
  const { id } = (ctx as { params: { id: string } }).params;
  await prisma.autoReplyRule.delete({ where: { id } });
  return successResponse({ ok: true });
});
```

- [ ] **Step 7: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음

- [ ] **Step 8: 커밋**

```bash
cd d:/Dev/social && git add src/app/api/engage/ && git commit -m "feat: Engage API routes 구현 (목록·수정·발송·폴·규칙 CRUD)"
```

---

## Task B3: Engage UI (engage/page.tsx)

**Files:**
- Modify: `src/app/engage/page.tsx` (stub → 전면 교체)

- [ ] **Step 1: engage/page.tsx 전면 교체**

```typescript
// src/app/engage/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Send, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EngageItem {
  id: string;
  platform: string;
  triggerType: string;
  authorName: string | null;
  text: string;
  aiDraft: string | null;
  flaggedSales: boolean;
  status: string;
  fetchedAt: string;
}

interface AutoReplyRule {
  id: string;
  platform: string;
  triggerType: string;
  keywords: string | null;
  autoSend: boolean;
  isActive: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  threads: "bg-gray-100 text-gray-700",
  tiktok: "bg-blue-100 text-blue-700",
  youtube: "bg-red-100 text-red-700",
  x: "bg-sky-100 text-sky-700",
};

const FILTER_TABS = [
  { key: "all", label: "전체" },
  { key: "comment", label: "댓글" },
  { key: "dm", label: "DM" },
  { key: "sales", label: "🔴 세일즈" },
];

export default function EngagePage() {
  const [items, setItems] = useState<EngageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [pollingX, setPollingX] = useState(false);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "sales") { params.set("status", "sales"); }
      else if (filter === "comment" || filter === "dm") { params.set("triggerType", filter); }
      const res = await window.fetch(`/api/engage?${params}`);
      const data = await res.json() as { success: boolean; data: { items: EngageItem[]; total: number } };
      if (data.success) { setItems(data.data.items); setTotal(data.data.total); }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchRules = async () => {
    const res = await window.fetch("/api/engage/rules");
    const data = await res.json() as { success: boolean; data: AutoReplyRule[] };
    if (data.success) setRules(data.data);
  };

  useEffect(() => { void fetchItems(); }, [fetchItems]);
  useEffect(() => { if (showRules) void fetchRules(); }, [showRules]);

  useEffect(() => {
    if (selectedItem) setDraftText(selectedItem.aiDraft ?? "");
  }, [selectedItem]);

  const handleSend = async () => {
    if (!selectedId || !draftText.trim()) return;
    setSending(true);
    try {
      const res = await window.fetch(`/api/engage/${selectedId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftText }),
      });
      const data = await res.json() as { success: boolean; error?: { message: string } };
      if (data.success) {
        toast.success("발송되었습니다.");
        setSelectedId(null);
        void fetchItems();
      } else {
        toast.error(data.error?.message ?? "발송 실패");
      }
    } finally {
      setSending(false);
    }
  };

  const handleIgnore = async () => {
    if (!selectedId) return;
    await window.fetch(`/api/engage/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ignored" }),
    });
    setSelectedId(null);
    void fetchItems();
  };

  const handlePollX = async () => {
    setPollingX(true);
    try {
      await window.fetch("/api/engage/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "x" }),
      });
      toast.success("X 갱신 완료");
      void fetchItems();
    } finally {
      setPollingX(false);
    }
  };

  const handleToggleAutoSend = async (rule: AutoReplyRule) => {
    await window.fetch(`/api/engage/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSend: !rule.autoSend }),
    });
    void fetchRules();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">댓글/DM 관리</h1>
          <p className="text-muted-foreground text-sm mt-0.5">전체 {total}건</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchItems()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handlePollX} disabled={pollingX}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${pollingX ? "animate-spin" : ""}`} />
            X 수동 갱신
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)}>
            ⚙️ 자동응답 규칙
          </Button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 border-b pb-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* 좌측: 수신함 리스트 */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border rounded-lg">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 border-b">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              수신된 항목이 없습니다.
            </div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                  selectedId === item.id ? "bg-muted" : ""
                } ${item.status !== "pending" ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {item.flaggedSales && <span className="text-orange-500">●</span>}
                  <span className="text-sm font-medium truncate">
                    {item.authorName ?? "익명"}
                  </span>
                  <Badge className={`text-xs ml-auto ${PLATFORM_COLORS[item.platform] ?? ""}`}>
                    {item.platform}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.text}</p>
              </button>
            ))
          )}
        </div>

        {/* 우측: 상세 + AI 초안 */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm border rounded-lg">
              좌측에서 항목을 선택하세요.
            </div>
          ) : (
            <>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedItem.authorName ?? "익명"}</span>
                  <Badge className={`text-xs ${PLATFORM_COLORS[selectedItem.platform] ?? ""}`}>
                    {selectedItem.platform}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{selectedItem.triggerType}</Badge>
                  {selectedItem.flaggedSales && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />세일즈 감지
                    </Badge>
                  )}
                </div>
                <div className="bg-muted rounded-md p-3 text-sm">{selectedItem.text}</div>
              </div>

              <div className="border rounded-lg p-4 space-y-3 flex-1">
                <Label>🤖 AI 초안 (편집 가능)</Label>
                <Textarea
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  rows={5}
                  placeholder="응답을 입력하거나 AI 초안을 수정하세요..."
                  disabled={selectedItem.status !== "pending"}
                />
                {selectedItem.status === "pending" && (
                  <div className="flex gap-2">
                    <Button onClick={() => void handleSend()} disabled={sending || !draftText.trim()} size="sm">
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      {sending ? "발송 중..." : "발송"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleIgnore()}>
                      <X className="h-3.5 w-3.5 mr-1.5" />무시
                    </Button>
                  </div>
                )}
                {selectedItem.status !== "pending" && (
                  <p className="text-xs text-muted-foreground">
                    {selectedItem.status === "replied" ? "✅ 답변 완료" : "⏭️ 무시됨"}
                  </p>
                )}
              </div>
            </>
          )}

          {/* 자동응답 규칙 섹션 */}
          {showRules && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">⚙️ 자동응답 규칙</h3>
              {rules.length === 0 ? (
                <p className="text-xs text-muted-foreground">등록된 규칙이 없습니다.</p>
              ) : (
                rules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between border rounded p-2.5 text-sm">
                    <div>
                      <span className="font-medium">{rule.platform}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{rule.triggerType}</span>
                      {rule.keywords && (
                        <span className="text-xs text-muted-foreground ml-2">
                          키워드: {rule.keywords}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.autoSend}
                          onChange={() => void handleToggleAutoSend(rule)}
                          className="rounded"
                        />
                        자동발송
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={async () => {
                          await window.fetch(`/api/engage/rules/${rule.id}`, { method: "DELETE" });
                          void fetchRules();
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <RuleCreateForm onCreated={() => void fetchRules()} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleCreateForm({ onCreated }: { onCreated: () => void }) {
  const [platform, setPlatform] = useState("instagram");
  const [triggerType, setTriggerType] = useState("comment");
  const [keywords, setKeywords] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await window.fetch("/api/engage/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          triggerType,
          keywords: keywords ? keywords.split(",").map(k => k.trim()) : undefined,
          autoSend,
        }),
      });
      setPlatform("instagram"); setTriggerType("comment"); setKeywords(""); setAutoSend(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs font-medium">규칙 추가</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={platform} onChange={e => setPlatform(e.target.value)}
        >
          {["instagram","threads","tiktok","youtube","x"].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={triggerType} onChange={e => setTriggerType(e.target.value)}
        >
          <option value="comment">댓글</option>
          <option value="dm">DM</option>
        </select>
      </div>
      <Input
        placeholder="키워드 (쉼표 구분, 비우면 전체)"
        value={keywords}
        onChange={e => setKeywords(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} className="rounded" />
          매칭 시 자동 발송
        </label>
        <Button size="sm" className="h-7 text-xs" onClick={() => void handleCreate()} disabled={saving}>
          {saving ? "저장 중..." : "추가"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
cd d:/Dev/social && git add src/app/engage/page.tsx && git commit -m "feat: Engage 2-패널 UI 구현"
```

---

## Task C1: analytics.service.ts

**Files:**
- Create: `src/services/analytics.service.ts`

- [ ] **Step 1: analytics.service.ts 생성**

```typescript
// src/services/analytics.service.ts
import { prisma } from "@/lib/prisma";
import { getPlatformAdapter } from "@/adapters";
import { getLLMProvider } from "@/ai";
import { logger } from "@/lib/logger";
import type { SocialAccount } from "@/generated/prisma/client";

function toMidnight(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

export const analyticsService = {
  /**
   * 계정의 발행된 게시물 성과를 수집해 PostAnalytics에 저장한다.
   */
  async syncPostAnalytics(account: SocialAccount): Promise<void> {
    try {
      const adapter = getPlatformAdapter(account.platform);
      const logs = await prisma.publishLog.findMany({
        where: { accountId: account.id, success: true, platformPostId: { not: null } },
        select: { postId: true, platformPostId: true },
      });

      for (const log of logs) {
        if (!log.platformPostId) continue;
        try {
          const analytics = await adapter.getPostAnalytics(account, log.platformPostId);
          await prisma.postAnalytics.upsert({
            where: { id: `${log.postId}_${account.platform}` },
            update: { ...analytics, fetchedAt: new Date() },
            create: {
              id: `${log.postId}_${account.platform}`,
              postId: log.postId,
              platform: account.platform,
              ...analytics,
            },
          });
        } catch (e) {
          logger.warn(`게시물 분석 수집 실패 (${log.platformPostId}):`, e);
        }
      }
    } catch (e) {
      logger.error(`syncPostAnalytics 실패 (${account.platform}):`, e);
    }
  },

  /**
   * 계정 레벨 오늘 스냅샷을 저장한다 (하루 1회 upsert).
   */
  async syncAccountSnapshot(account: SocialAccount): Promise<void> {
    try {
      const adapter = getPlatformAdapter(account.platform);
      const result = await adapter.getAccountAnalytics(account, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
      });
      const snapshotDate = toMidnight(new Date());

      await prisma.accountAnalyticsSnapshot.upsert({
        where: { accountId_snapshotDate: { accountId: account.id, snapshotDate } },
        update: {
          followers: account.followerCount,
          impressions: result.totalImpressions,
          reach: result.totalReach,
          engagement: result.totalEngagement,
        },
        create: {
          accountId: account.id,
          platform: account.platform,
          followers: account.followerCount,
          impressions: result.totalImpressions,
          reach: result.totalReach,
          engagement: result.totalEngagement,
          snapshotDate,
        },
      });
    } catch (e) {
      logger.error(`syncAccountSnapshot 실패 (${account.platform}):`, e);
    }
  },

  /**
   * 대시보드용 집계 데이터 반환.
   * platform = "all" 이면 전체 플랫폼 합산.
   */
  async getDashboard(platform: string, days: number): Promise<{
    snapshots: Array<{ snapshotDate: Date; impressions: number; reach: number; followers: number; platform: string }>;
    topPosts: Array<{ postId: string; platform: string; impressions: number; likes: number; title: string | null }>;
    summary: { totalImpressions: number; totalReach: number; followerGrowth: number };
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshotWhere = platform === "all"
      ? { snapshotDate: { gte: since } }
      : { platform, snapshotDate: { gte: since } };

    const snapshots = await prisma.accountAnalyticsSnapshot.findMany({
      where: snapshotWhere,
      orderBy: { snapshotDate: "asc" },
      select: { snapshotDate: true, impressions: true, reach: true, followers: true, platform: true },
    });

    const analyticsWhere = platform === "all" ? {} : { platform };
    const topPosts = await prisma.postAnalytics.findMany({
      where: analyticsWhere,
      orderBy: { impressions: "desc" },
      take: 5,
      include: { post: { select: { title: true } } },
    });

    const latestSnapshots = snapshots.slice(-1);
    const earliestSnapshots = snapshots.slice(0, 1);
    const totalImpressions = snapshots.reduce((s, v) => s + v.impressions, 0);
    const totalReach = snapshots.reduce((s, v) => s + v.reach, 0);
    const followerGrowth =
      (latestSnapshots[0]?.followers ?? 0) - (earliestSnapshots[0]?.followers ?? 0);

    return {
      snapshots,
      topPosts: topPosts.map(a => ({
        postId: a.postId,
        platform: a.platform,
        impressions: a.impressions,
        likes: a.likes,
        title: a.post.title,
      })),
      summary: { totalImpressions, totalReach, followerGrowth },
    };
  },

  /**
   * 지난 7일 성과를 기반으로 AI 주간 리포트를 생성한다.
   */
  async generateWeeklyReport(): Promise<string> {
    const dashboard = await this.getDashboard("all", 7);
    const llm = getLLMProvider();

    const context = `
[지난 7일 SNS 성과 요약]
- 총 노출: ${dashboard.summary.totalImpressions.toLocaleString()}회
- 총 도달: ${dashboard.summary.totalReach.toLocaleString()}명
- 팔로워 증감: ${dashboard.summary.followerGrowth >= 0 ? "+" : ""}${dashboard.summary.followerGrowth}명
- TOP 게시물: ${dashboard.topPosts.map(p => `"${p.title ?? "제목없음"}" (노출 ${p.impressions})`).join(", ")}
`.trim();

    return llm.generateText(
      `당신은 병원 SNS 마케팅 전문가입니다. 아래 데이터를 바탕으로 한국어로 주간 성과 리포트를 작성해주세요.\n잘된 점, 개선점, 다음 주 추천 콘텐츠 방향 3가지를 각각 간략히 정리해주세요.\n\n${context}`,
      { maxTokens: 500 }
    );
  },
};
```

- [ ] **Step 2: 타입 체크**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
cd d:/Dev/social && git add src/services/analytics.service.ts && git commit -m "feat: analytics.service 구현 (성과 수집·집계·AI리포트)"
```

---

## Task C2: Analytics API Routes

**Files:**
- Create: `src/app/api/analytics/route.ts`
- Create: `src/app/api/analytics/sync/route.ts`
- Create: `src/app/api/analytics/report/route.ts`

- [ ] **Step 1: GET /api/analytics — 대시보드 데이터**

```typescript
// src/app/api/analytics/route.ts
import { type NextRequest } from "next/server";
import { apiHandler, successResponse } from "@/lib/api-response";
import { analyticsService } from "@/services/analytics.service";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? "all";
  const days = Number(searchParams.get("days") ?? "30");
  const data = await analyticsService.getDashboard(platform, days);
  return successResponse(data);
});
```

- [ ] **Step 2: POST /api/analytics/sync — 수동 동기화**

```typescript
// src/app/api/analytics/sync/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics.service";

export const POST = apiHandler(async () => {
  const accounts = await prisma.socialAccount.findMany({ where: { isActive: true } });
  await Promise.allSettled(
    accounts.flatMap(account => [
      analyticsService.syncPostAnalytics(account),
      analyticsService.syncAccountSnapshot(account),
    ])
  );
  return successResponse({ synced: accounts.length });
});
```

- [ ] **Step 3: POST /api/analytics/report — AI 주간 리포트**

```typescript
// src/app/api/analytics/report/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { analyticsService } from "@/services/analytics.service";

export const POST = apiHandler(async () => {
  const report = await analyticsService.generateWeeklyReport();
  return successResponse({ report });
});
```

- [ ] **Step 4: 빌드 확인**

```bash
cd d:/Dev/social && npx tsc --noEmit 2>&1 | head -20
```

Expected: 출력 없음

- [ ] **Step 5: 커밋**

```bash
cd d:/Dev/social && git add src/app/api/analytics/ && git commit -m "feat: Analytics API routes 구현 (대시보드·동기화·AI리포트)"
```

---

## Task C3: Analytics UI + Recharts

**Files:**
- Modify: `src/app/analytics/page.tsx` (stub → 전면 교체)

- [ ] **Step 1: recharts 설치**

```bash
cd d:/Dev/social && npm install recharts
```

Expected: `added N packages`

- [ ] **Step 2: analytics/page.tsx 전면 교체**

```typescript
// src/app/analytics/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

interface Snapshot {
  snapshotDate: string;
  impressions: number;
  reach: number;
  followers: number;
  platform: string;
}

interface TopPost {
  postId: string;
  platform: string;
  impressions: number;
  likes: number;
  title: string | null;
}

interface DashboardData {
  snapshots: Snapshot[];
  topPosts: TopPost[];
  summary: { totalImpressions: number; totalReach: number; followerGrowth: number };
}

const PLATFORMS = [
  { key: "all", label: "🌐 전체" },
  { key: "instagram", label: "📸 Instagram" },
  { key: "threads", label: "🧵 Threads" },
  { key: "tiktok", label: "🎵 TikTok" },
  { key: "youtube", label: "📺 YouTube" },
  { key: "x", label: "🐦 X" },
];

const PERIOD_OPTIONS = [
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "90", label: "90일" },
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#e879f9",
  threads: "#000000",
  tiktok: "#3b82f6",
  youtube: "#ef4444",
  x: "#0ea5e9",
  all: "#6366f1",
};

export default function AnalyticsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [days, setDays] = useState("30");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch(`/api/analytics?platform=${selectedPlatform}&days=${days}`);
      const json = await res.json() as { success: boolean; data: DashboardData };
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform, days]);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await window.fetch("/api/analytics/sync", { method: "POST" });
      const json = await res.json() as { success: boolean; data: { synced: number } };
      if (json.success) {
        toast.success(`${json.data.synced}개 계정 동기화 완료`);
        void fetchDashboard();
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReport(null);
    try {
      const res = await window.fetch("/api/analytics/report", { method: "POST" });
      const json = await res.json() as { success: boolean; data: { report: string } };
      if (json.success) setReport(json.data.report);
      else toast.error("리포트 생성 실패");
    } finally {
      setReportLoading(false);
    }
  };

  // 스냅샷을 날짜별로 집계 (차트용)
  const chartData = (() => {
    if (!data) return [];
    const byDate: Record<string, { date: string; impressions: number; reach: number }> = {};
    for (const s of data.snapshots) {
      const date = s.snapshotDate.slice(0, 10);
      if (!byDate[date]) byDate[date] = { date, impressions: 0, reach: 0 };
      byDate[date].impressions += s.impressions;
      byDate[date].reach += s.reach;
    }
    return Object.values(byDate);
  })();

  // 전체 선택 시 플랫폼별 비교 데이터
  const platformBarData = (() => {
    if (!data || selectedPlatform !== "all") return [];
    const byPlatform: Record<string, number> = {};
    for (const s of data.snapshots) {
      byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + s.impressions;
    }
    return Object.entries(byPlatform).map(([platform, impressions]) => ({ platform, impressions }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">성과 분석</h1>
        <div className="flex gap-2 items-center">
          <select
            className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            value={days}
            onChange={e => setDays(e.target.value)}
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void handleSync()} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            동기화
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* 좌측: 플랫폼 패널 */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {PLATFORMS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedPlatform(p.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selectedPlatform === p.key
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted"
              }`}
            >
              {p.label}
              {p.key === "x" && (
                <span className="text-xs text-muted-foreground ml-1">(수동)</span>
              )}
            </button>
          ))}
        </div>

        {/* 우측: 대시보드 */}
        <div className="flex-1 space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-4"><Skeleton className="h-8 w-24" /></CardContent></Card>
              ))
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">총 노출</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold">{(data?.summary.totalImpressions ?? 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">총 도달</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold">{(data?.summary.totalReach ?? 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">팔로워 증감</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className={`text-2xl font-bold ${(data?.summary.followerGrowth ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {(data?.summary.followerGrowth ?? 0) >= 0 ? "+" : ""}{(data?.summary.followerGrowth ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* 추이 차트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {selectedPlatform === "all" ? "전체 노출 추이" : `${selectedPlatform} 노출 추이`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : chartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                  데이터가 없습니다. 동기화를 실행해주세요.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke={PLATFORM_COLORS[selectedPlatform] ?? "#6366f1"}
                      dot={false}
                      strokeWidth={2}
                      name="노출"
                    />
                    <Line type="monotone" dataKey="reach" stroke="#94a3b8" dot={false} strokeWidth={1.5} name="도달" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 전체일 때 플랫폼 비교 바 차트 */}
          {selectedPlatform === "all" && platformBarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">플랫폼별 총 노출 비교</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={platformBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="impressions" name="노출" fill="#6366f1" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* TOP 게시물 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🏆 TOP 게시물</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full mb-2" />)
              ) : (data?.topPosts.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">게시물 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {data?.topPosts.map((post, i) => (
                    <div key={post.postId} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-4">{i + 1}.</span>
                      <span className="flex-1 truncate">{post.title ?? "제목 없음"}</span>
                      <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                      <span className="text-muted-foreground text-xs">노출 {post.impressions.toLocaleString()}</span>
                      <span className="text-muted-foreground text-xs">❤️ {post.likes}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI 주간 리포트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🤖 AI 주간 리포트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleGenerateReport()}
                disabled={reportLoading}
              >
                <Wand2 className="h-4 w-4 mr-1.5" />
                {reportLoading ? "생성 중..." : "주간 리포트 생성"}
              </Button>
              {report && (
                <div className="bg-muted rounded-md p-4 text-sm whitespace-pre-wrap leading-relaxed">
                  {report}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd d:/Dev/social && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: 커밋**

```bash
cd d:/Dev/social && git add src/app/analytics/page.tsx package.json package-lock.json && git commit -m "feat: Analytics 대시보드 UI 구현 (Recharts + AI 리포트)"
```

---

## Task D1: 스케줄러 활성화

**Files:**
- Modify: `src/scheduler/jobs/engage-poll.job.ts`
- Modify: `src/scheduler/jobs/analytics-sync.job.ts`

- [ ] **Step 1: engage-poll.job.ts 활성화**

파일 전체를 교체:
```typescript
// src/scheduler/jobs/engage-poll.job.ts
// 15분마다 연동된 계정(X 제외)의 댓글/DM을 수집하고 AI 초안을 생성한다.
import { prisma } from "@/lib/prisma";
import { engageService } from "@/services/engage.service";
import { logger } from "@/lib/logger";

export async function engagePollJob(): Promise<void> {
  logger.info("[Scheduler] engage-poll 시작");
  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true, platform: { not: "x" } },
  });
  await Promise.allSettled(
    accounts.map(account => engageService.pollAndProcess(account))
  );
  logger.info(`[Scheduler] engage-poll 완료 (${accounts.length}개 계정)`);
}
```

- [ ] **Step 2: analytics-sync.job.ts 활성화**

파일 전체를 교체:
```typescript
// src/scheduler/jobs/analytics-sync.job.ts
// 6시간마다 연동된 계정의 성과 데이터를 수집해 DB에 저장한다.
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics.service";
import { logger } from "@/lib/logger";

export async function analyticsSyncJob(): Promise<void> {
  logger.info("[Scheduler] analytics-sync 시작");
  const accounts = await prisma.socialAccount.findMany({ where: { isActive: true } });
  await Promise.allSettled(
    accounts.flatMap(account => [
      analyticsService.syncPostAnalytics(account),
      analyticsService.syncAccountSnapshot(account),
    ])
  );
  logger.info(`[Scheduler] analytics-sync 완료 (${accounts.length}개 계정)`);
}
```

- [ ] **Step 3: scheduler/index.ts에서 15분·6시간 주기 확인**

`src/scheduler/index.ts`를 읽어 `engagePollJob`은 `*/15 * * * *`, `analyticsSyncJob`은 `0 */6 * * *` 크론 표현식으로 등록되어 있는지 확인한다. 등록되어 있지 않으면 아래 패턴으로 추가한다:

```typescript
// 확인용 - 이미 등록되어 있으면 cron 표현식만 변경
cron.schedule("*/15 * * * *", () => { void engagePollJob(); });
cron.schedule("0 */6 * * *",  () => { void analyticsSyncJob(); });
```

- [ ] **Step 4: 최종 빌드**

```bash
cd d:/Dev/social && npm run build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
cd d:/Dev/social && git add src/scheduler/ && git commit -m "feat: Phase 3 완료 — engage-poll·analytics-sync 스케줄러 활성화"
```

---

## 최종 검증

```bash
# 타입 체크
cd d:/Dev/social && npx tsc --noEmit

# 신규 라우트 확인 (빌드 출력에서)
# ƒ /api/engage
# ƒ /api/engage/[id]
# ƒ /api/engage/[id]/send
# ƒ /api/engage/poll
# ƒ /api/engage/rules
# ƒ /api/engage/rules/[id]
# ƒ /api/analytics
# ƒ /api/analytics/sync
# ƒ /api/analytics/report
# ○ /engage
# ○ /analytics
```
