# Phase 3 설계 문서: Engage + Analytics

**날짜:** 2026-04-06  
**프로젝트:** 병원 SNS 마케팅 자동화 도구  
**범위:** 댓글/DM 자동 관리 + 성과 분석 대시보드 + AI 리포트

---

## 1. 범위

### 포함
- 댓글/DM 폴링 수집 (Instagram / Threads / TikTok / YouTube — 15분 주기)
- X(Twitter) 수동 갱신 전용 (무료 API READ 한도 문제)
- AI 응답 초안 자동 생성 (스케줄러가 미리 생성)
- 세일즈 키워드 감지 → Notification 생성
- 자동응답 규칙별 autoSend 토글
- 성과 분석 대시보드 — 플랫폼 선택형 (좌측 패널 + 우측 상세)
- AI 주간 리포트 온디맨드 생성
- Prisma 마이그레이션 (신규 모델 2개 + 필드 추가 1개)

### 제외
- AI 인사이트 챗봇 (Phase 4로 이관)
- 웹훅 실시간 수신 (폴링으로 대체)

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   Scheduler (node-cron)              │
│  engage-poll.job  ←──── 15분 (IG/Threads/TikTok/YT) │
│  analytics-sync.job ←── 6시간 (전 플랫폼)           │
└────────────┬─────────────────────┬──────────────────┘
             ▼                     ▼
  engage.service.ts       analytics.service.ts
       ↓                          ↓
 PlatformAdapter            PlatformAdapter
 (getComments /              (getPostAnalytics /
  getMessages)               getAccountAnalytics)
       ↓                          ↓
   LLMProvider             EngageItem (DB)
  (AI 초안 생성)     AccountAnalyticsSnapshot (DB)
       ↓                     PostAnalytics (DB)
  EngageItem (DB)
       ↓
  Notification (DB)  ←── 세일즈 감지 시
```

**설계 원칙:**
- 기존 PlatformAdapter / LLMProvider / apiHandler 패턴 재사용
- 스케줄러가 데이터 수집 + AI 초안 생성 → UI는 조회/승인만
- X는 수동 갱신만 — 폴링 대상에서 명시적 제외

---

## 3. 데이터 모델

### 3.1 신규: EngageItem

수신된 댓글/DM 원문 + AI 초안 저장. 수신함의 단위 항목.

```prisma
model EngageItem {
  id             String    @id @default(cuid())
  platform       String    // instagram | threads | tiktok | youtube | x
  triggerType    String    // comment | dm
  platformItemId String    // 플랫폼 고유 ID
  platformPostId String?   // 댓글 원본 게시물 ID (댓글인 경우)
  authorId       String?   // 작성자 플랫폼 ID
  authorName     String?   // 작성자 표시 이름
  text           String    // 원문 텍스트
  aiDraft        String?   // AI 생성 응답 초안
  flaggedSales   Boolean   @default(false) // 세일즈 키워드 감지 여부
  status         String    @default("pending") // pending | replied | ignored
  autoSent       Boolean   @default(false) // 자동 발송으로 처리된 항목
  repliedAt      DateTime?
  fetchedAt      DateTime  @default(now())

  @@unique([platform, platformItemId])
  @@index([platform, status])
  @@index([flaggedSales])
  @@index([fetchedAt])
}
```

### 3.2 신규: AccountAnalyticsSnapshot

계정 레벨 일별 스냅샷. 추이 차트(LineChart)에 사용.

```prisma
model AccountAnalyticsSnapshot {
  id           String   @id @default(cuid())
  accountId    String
  platform     String
  followers    Int      @default(0)
  impressions  Int      @default(0)
  reach        Int      @default(0)
  engagement   Int      @default(0)
  snapshotDate DateTime // 날짜 기준 (시간 무시, 하루 1개)

  @@unique([accountId, snapshotDate])
  @@index([platform, snapshotDate])
}
// 주의: snapshotDate는 저장 전 반드시 해당일 자정(00:00:00.000Z)으로 정규화 후 upsert.
// 예: new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z")
```

### 3.3 기존 AutoReplyRule — 필드 추가

```prisma
// 추가할 필드
autoSend  Boolean  @default(false)  // 규칙 매칭 시 자동 발송 여부
```

---

## 4. Engage 서브시스템

### 4.1 engage.service.ts

```typescript
// 주요 메서드 시그니처

async pollAndProcess(account: SocialAccount): Promise<void>
// 1. adapter.getComments() + getMessages() 호출
// 2. @@unique([platform, platformItemId])로 중복 스킵
// 3. 신규 항목: AI 초안 생성 (LLMProvider)
// 4. salesKeywords 매칭 → flaggedSales=true + Notification 생성
// 5. AutoReplyRule.autoSend=true 매칭 → 즉시 발송 + status="replied"
// 에러 처리: 계정별 try/catch — 한 플랫폼 실패가 다른 플랫폼 폴링을 막지 않음

async listItems(filters: {
  platform?: string;
  status?: string;
  triggerType?: string;
  page?: number;
}): Promise<{ items: EngageItem[]; total: number }>

async sendReply(id: string, text: string): Promise<void>
// adapter.replyToComment() 또는 sendMessage() 호출
// status="replied", repliedAt=now() 업데이트

async updateItem(id: string, patch: Partial<EngageItem>): Promise<EngageItem>
// aiDraft 수정, status 변경 등
```

**AI 초안 생성 프롬프트 방향:**
- 시스템: "당신은 병원 SNS 관리자입니다. 친절하고 전문적인 한국어로 답변하세요."
- 컨텍스트: 플랫폼, 원문 텍스트
- 응답: 100자 이내 간결한 답변

### 4.2 API Routes

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/engage` | 목록 (platform/status/triggerType/page 필터) |
| PATCH | `/api/engage/[id]` | 초안 수정 / 상태 변경 |
| POST | `/api/engage/[id]/send` | 응답 발송 |
| POST | `/api/engage/poll` | 수동 갱신 (X 전용) |
| GET | `/api/engage/rules` | 자동응답 규칙 목록 |
| POST | `/api/engage/rules` | 규칙 생성 |
| PATCH | `/api/engage/rules/[id]` | 규칙 수정 |
| DELETE | `/api/engage/rules/[id]` | 규칙 삭제 |

### 4.3 engage/page.tsx UI

이메일형 2-패널 레이아웃:

```
┌─────────────────┬──────────────────────────────────┐
│ 필터 탭         │ @user_kim — Instagram 댓글        │
│ 전체 / 댓글 /   │                                  │
│ DM / 🔴세일즈  │ "예약은 어떻게 하나요?"           │
│ ─────────────── │                                  │
│ 🔴 @park_health │ 🤖 AI 초안:                      │
│    도수치료...  │ ┌──────────────────────────────┐ │
│ ─────────────── │ │ "안녕하세요! 예약은 전화나   │ │
│ ● @user_kim     │ │ 카카오톡으로 가능합니다..."  │ │
│   예약 문의     │ └──────────────────────────────┘ │
│ ─────────────── │                                  │
│ @j_runner       │ [발송]  [무시]                   │
│   감사합니다    │                                  │
│                 │ ─────────────────────────────── │
│ [X: 수동갱신]   │ ⚙️ 자동응답 규칙 관리 (하단)    │
└─────────────────┴──────────────────────────────────┘
```

- 좌측: 필터 탭 + 항목 리스트 (플랫폼 배지, 세일즈 빨간 점)
- 우측 상단: 원문 + AI 초안 편집 textarea + 발송/무시
- 우측 하단: 자동응답 규칙 CRUD (autoSend 토글 포함)
- X: 좌측 하단 "수동 갱신" 버튼

**스케줄러:** 15분마다 연동된 계정 순회 (X 제외)

---

## 5. Analytics 서브시스템

### 5.1 analytics.service.ts

```typescript
async syncPostAnalytics(account: SocialAccount): Promise<void>
// PublishLog에서 platformPostId 조회
// → adapter.getPostAnalytics() 호출
// → PostAnalytics upsert (fetchedAt 갱신)

async syncAccountSnapshot(account: SocialAccount): Promise<void>
// adapter.getAccountAnalytics() 호출
// → AccountAnalyticsSnapshot upsert (오늘 날짜 기준)

async getDashboard(platform: string, days: number): Promise<{
  snapshots: AccountAnalyticsSnapshot[];
  topPosts: (PostAnalytics & { post: Post })[];
  summary: { totalImpressions; totalReach; followerGrowth };
}>

async generateWeeklyReport(): Promise<string>
// 지난 7일 집계 데이터 → LLM 전달
// → 한국어 주간 성과 분석 리포트 (마크다운)
```

**AI 리포트 프롬프트 방향:**
- 입력: 플랫폼별 노출/도달/인게이지, TOP 게시물, 팔로워 변동
- 출력: 잘된 점 / 개선점 / 다음 주 추천 콘텐츠 방향 (500자 내외)

### 5.2 API Routes

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/analytics` | 대시보드 데이터 (platform/days 파라미터) |
| POST | `/api/analytics/sync` | 수동 동기화 트리거 |
| POST | `/api/analytics/report` | AI 주간 리포트 생성 |

### 5.3 analytics/page.tsx UI

플랫폼 선택형 대시보드:

```
┌──────────────┬──────────────────────────────────────┐
│ 📅 30일 ▼   │ Instagram                 [동기화]   │
│              │ 팔로워 3,241  노출 12.4K  도달 8.1K  │
│ 🌐 전체      │                                      │
│  12.4K 노출  │ 📈 노출 추이 (Recharts LineChart)    │
│              │ ─────────────────────────────────    │
│ 📸 Instagram │                         ╱            │
│  7.4K ↑23%  │              ╱──────────╯            │
│              │                                      │
│ 🧵 Threads   │ 🏆 TOP 게시물                        │
│  3.1K ↑18%  │ 1. 봄 피부관리    노출2.1K  ❤️84    │
│              │ 2. 건강검진안내   노출1.8K  ❤️61    │
│ 🎵 TikTok    │ 3. 혈압약주의사항 노출1.4K  ❤️49    │
│  1.2K        │                                      │
│ 📺 YouTube   │ [AI 주간 리포트 생성]                │
│  0.8K        │ (생성 후 마크다운 텍스트로 표시)      │
│              │                                      │
│ 🐦 X         │                                      │
│  0.5K        │                                      │
└──────────────┴──────────────────────────────────────┘
```

**차트 라이브러리:** Recharts (`npm install recharts`)
- LineChart: 기간별 노출/도달 추이
- 전체(🌐) 선택 시: 플랫폼별 BarChart 비교

**스케줄러:** 6시간마다 전 플랫폼 동기화

---

## 6. 신규 파일 목록

```
# 서비스
src/services/engage.service.ts              ← 신규
src/services/analytics.service.ts           ← 신규

# API Routes
src/app/api/engage/route.ts                 ← 신규
src/app/api/engage/[id]/route.ts            ← 신규
src/app/api/engage/[id]/send/route.ts       ← 신규
src/app/api/engage/poll/route.ts            ← 신규 (X 수동갱신)
src/app/api/engage/rules/route.ts           ← 신규
src/app/api/engage/rules/[id]/route.ts      ← 신규
src/app/api/analytics/route.ts              ← 신규
src/app/api/analytics/sync/route.ts         ← 신규
src/app/api/analytics/report/route.ts       ← 신규

# 페이지 (교체)
src/app/engage/page.tsx                     ← 전면 교체
src/app/analytics/page.tsx                  ← 전면 교체

# 스케줄러 (활성화)
src/scheduler/jobs/engage-poll.job.ts       ← stub 교체
src/scheduler/jobs/analytics-sync.job.ts    ← stub 교체

# 스키마
prisma/schema.prisma                        ← 모델 추가/수정
```

---

## 7. 기술 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| X 폴링 | 제외 (수동 갱신만) | 무료 API 월 500 READ 한도 |
| 폴링 주기 | 15분 (Engage), 6시간 (Analytics) | API 한도 안전 범위 |
| AI 초안 타이밍 | 스케줄러 미리 생성 | 페이지 로딩 시 즉시 표시 |
| autoSend 단위 | AutoReplyRule 별 토글 | 단순 감사 댓글 자동, 문의는 수동 |
| 차트 라이브러리 | Recharts | shadcn/ui 표준 |
| AI 리포트 | 온디맨드 생성 | 비용 절약, 필요할 때만 |
| 중복 수집 방지 | @@unique([platform, platformItemId]) | DB 레벨 보장 |
