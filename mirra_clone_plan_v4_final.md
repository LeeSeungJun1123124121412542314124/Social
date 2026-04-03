# Mirr 클론 서비스 기본 계획서 (v4 — 최종)

> **작성일**: 2026-04-03  
> **분석 대상**: https://www.mirra.my  
> **용도**: 1인 전용 SNS 마케팅 자동화 도구 → 병원 로컬 서버 납품  
> **인프라**: Next.js + Prisma + SQLite / 병원 로컬 서버 배포  
> **외부 API 접근**: 허용 확인됨

---

## 1. 서비스 정의

SNS 계정 연동 후 AI가 콘텐츠 기획 → 제작 → 예약 발행 → 댓글/DM 관리 → 성과 분석까지 처리하는 개인용 SNS 마케팅 도구.

**제외 항목**: 회원가입/로그인, 팀 협업, 온보딩 퀘스트, 요금제/크레딧, 랜딩 페이지, FAQ, 경쟁사 비교, 고객 리뷰, 페르소나 기술 소개, 이용약관, 개인정보처리방침, 문의 페이지

---

## 2. 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|-----------|
| 프레임워크 | Next.js + TypeScript | 풀스택 단일 프로젝트, API Route 내장 |
| 스타일링 | Tailwind CSS | 빠른 UI 개발 |
| ORM | Prisma | 타입 안전, 스키마 관리, 마이그레이션 자동 |
| DB | SQLite | 파일 1개, 설치 없음, 병원 납품 시 세팅 최소화 |
| 예약 발행 | node-cron (서버 프로세스 내) | 로컬 서버에서 상시 실행, 외부 의존 없음 |
| 배포 | 병원 로컬 서버 (PM2 + Nginx) | 데이터 외부 유출 없음, 병원 보안 정책 준수 |

---

## 3. 핵심 기능 상세

### 3.1 SNS 계정 연동

**지원 플랫폼**: Instagram, TikTok, YouTube, Threads, X(Twitter)

**연동 플로우**:
1. 플랫폼 선택 (아이콘 + 이름 버튼 5개)
2. OAuth 인증 리다이렉트
3. 연동 완료 → 계정 목록에 추가

**계정 관리**:
- 연동 계정 목록 (플랫폼 아이콘, 프로필명, 팔로워 수)
- 계정 추가/삭제
- 토큰 자동 갱신 (만료 전 refresh)

**연동 페이지 부가 UI**:
- 트러블슈팅 안내 (VPN 끄기, 데스크톱 권장, 복수 계정 방법)
- 데이터 보안 안내 (암호화, 삭제 보장)

### 3.2 카드뉴스 랩

**탭 3개**:

| 탭 | 기능 |
|----|------|
| 카드뉴스 생성 | 3단계 워크플로우로 제작 |
| 나만의 디자인 학습 | 참고 이미지 업로드 → AI 스타일 학습 → 커스텀 템플릿 |
| 생성기록 | 과거 결과물 히스토리 |

**생성 워크플로우** (3단계):

| 단계 | 내용 |
|------|------|
| 1. 디자인 선택 | 바로 만들기 / 템플릿 선택 / 내 디자인 적용 중 택 1 |
| 2. 콘텐츠 입력 | 주제/본문 텍스트 입력 |
| 3. 결과 확인 | AI 생성물 프리뷰 + 편집 |

### 3.3 숏폼 영상 생성

1. 아이디어/기획 텍스트 입력
2. AI 스토리보드 자동 생성 (Hook → 본문 → 레이아웃)
3. 내레이션 + BGM + 이미지 합성 → 숏폼 완성 (30~60초)

### 3.4 AI 콘텐츠 대량 기획

1. 연결된 SNS 계정 분석 → 오디언스 맞춤 아이디어 자동 생성
2. 아이디어 선별/편집
3. 선택한 아이디어로 콘텐츠 일괄 생성

### 3.5 콘텐츠 캘린더

- **뷰**: 캘린더 / 리스트 전환, 주간 / 월간 전환
- **상태 필터**: 전체, 발행됨, 예약됨, 임시저장, 실패
- **탭**: 관련 게시물 / 임시저장
- **액션**: 새 콘텐츠 예약, 날짜 클릭 빠른 예약
- **예약 발행**: node-cron이 매 분 DB 체크 → 시간 도래 시 SNS API 호출

### 3.6 콘텐츠 리퍼포징

1개 소스(블로그, 영상, 아이디어, 스크립트) → 다중 포맷 변환:

| 출력 포맷 | 사양 |
|-----------|------|
| 카드뉴스 | 5~10장 |
| 텍스트 포스트 | 멀티 플랫폼 최적화 |
| 숏폼 영상 | 30~60초 |
| 블로그 아티클 | 2000자+ |
| 뉴스레터 | 오픈율 최적화 |
| 쓰레드/시리즈 | 5~10개 포스트 |

### 3.7 댓글/DM 자동 관리

- 단순 댓글 → AI 즉시 자동 응답
- 세일즈/중요 문의 → 알림 전달
- DM 수신 → AI 자동 응답

### 3.8 성과 분석

- **대시보드**: SNS 지표 시각화 (조회수, 도달, 인게이지먼트)
- **AI 리포트**: 자동 성과 분석 보고서
- **AI 인사이트 챗봇**: 자연어 질문 → 데이터 기반 답변

### 3.9 멀티채널 동시 발행

하나의 콘텐츠를 채널별 포맷에 맞춰 동시 발행.
대상: Threads, Instagram, YouTube, TikTok, LinkedIn, WordPress, Facebook, Pinterest, Telegram

---

## 4. UI 구조

### 4.1 레이아웃

```
┌─────────────────────────────────────────────────┐
│  [로고]                             [알림]       │
├──────┬──────────────────────────────────────────┤
│      │                                          │
│ • 홈  │           메인 콘텐츠 영역                │
│ • SNS │                                          │
│   계정│                                          │
│ • 카드│                                          │
│   뉴스│                                          │
│ • 캘린│                                          │
│   더  │                                          │
│ • 분석│                                          │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

### 4.2 사이드바 메뉴

| 메뉴 | 기능 |
|------|------|
| 홈 | 연동 계정 현황 요약, 각 기능 빠른 진입 |
| SNS 계정 | 계정 연동/관리 |
| 카드뉴스 랩 | 카드뉴스 생성/학습/기록 |
| 캘린더 | 콘텐츠 예약/발행 관리 |
| 분석 | 성과 대시보드 + AI 리포트 |

**추가 진입점** (홈 또는 별도 메뉴):
- 숏폼 생성, AI 대량 기획, 리퍼포징, 댓글/DM 관리

---

## 5. 데이터 모델 (Prisma Schema)

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./data.db"
}

model SocialAccount {
  id            String   @id @default(cuid())
  platform      String   // instagram, tiktok, youtube, threads, x
  accessToken   String
  refreshToken  String?
  profileName   String
  profileImage  String?
  followerCount Int      @default(0)
  tokenExpiresAt DateTime?
  connectedAt   DateTime @default(now())
  posts         Post[]   @relation("PostAccounts")
}

model Post {
  id              String   @id @default(cuid())
  type            String   // text, carousel, blog, short, thread
  contentText     String?
  mediaUrls       String?  // JSON array
  status          String   @default("draft") // draft, scheduled, published, failed
  scheduledAt     DateTime?
  publishedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  targetAccounts  SocialAccount[] @relation("PostAccounts")
  analytics       PostAnalytics?
}

model PostAnalytics {
  id          String @id @default(cuid())
  postId      String @unique
  post        Post   @relation(fields: [postId], references: [id])
  impressions Int    @default(0)
  reach       Int    @default(0)
  engagement  Int    @default(0)
  clicks      Int    @default(0)
  comments    Int    @default(0)
  fetchedAt   DateTime @default(now())
}

model Template {
  id        String   @id @default(cuid())
  name      String
  type      String   // carousel, text
  styleData String?  // JSON
  thumbnail String?
  createdAt DateTime @default(now())
}

model ContentIdea {
  id          String   @id @default(cuid())
  topic       String
  description String?
  used        Boolean  @default(false)
  generatedAt DateTime @default(now())
}

model AutoReplyLog {
  id           String   @id @default(cuid())
  platform     String
  triggerType   String   // comment, dm
  originalText String
  replyText    String
  flaggedSales Boolean  @default(false)
  createdAt    DateTime @default(now())
}

model Notification {
  id        String   @id @default(cuid())
  type      String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

## 6. 외부 API 의존성

| API | 용도 |
|-----|------|
| Instagram Graph API | 게시물 발행, 댓글, 인사이트 |
| YouTube Data API | 영상 업로드, 댓글, 분석 |
| TikTok API | 영상 발행 |
| Threads API | 텍스트/이미지 발행 |
| X (Twitter) API | 트윗 발행, 댓글 |
| LLM API (OpenAI/Anthropic) | 텍스트 생성 전반 |
| 이미지 생성 API | 카드뉴스 (FLUX, DALL-E 등) |
| 영상 생성 API | 숏폼 (Kling, fal.ai 등) |
| TTS API | 숏폼 내레이션 (edge-tts 등) |

---

## 7. 배포 구성 (병원 로컬 서버)

```
병원 로컬 서버 (Windows or Linux)
├── Node.js (LTS)
├── PM2 (프로세스 매니저 — 자동 재시작, 로그 관리)
├── Nginx (리버스 프록시 — HTTPS, 포트 포워딩)
├── Next.js 앱
│   ├── 프론트엔드 (React)
│   ├── API Routes (백엔드)
│   ├── node-cron (예약 발행 스케줄러)
│   └── data.db (SQLite — 단일 파일)
└── .env (API 키, OAuth 시크릿)
```

**납품 시 설치 절차**:
1. Node.js 설치
2. 프로젝트 폴더 복사
3. `npm install` → `npx prisma migrate deploy` → `npm run build`
4. PM2로 실행: `pm2 start npm --name "sns-tool" -- start`
5. Nginx 설정 (선택)
6. `.env`에 API 키 입력

**백업**: `data.db` 파일 1개만 복사하면 됨.

---

## 8. 개발 로드맵

### Phase 1: 뼈대 + SNS 연동 (3주)

- Next.js + TypeScript + Tailwind 셋업
- Prisma + SQLite 초기 스키마
- 메인 레이아웃 (사이드바, 상단바)
- SNS 계정 연동 (5개 플랫폼 OAuth)
- 계정 관리 (목록, 추가, 삭제)
- 홈 대시보드 (계정 현황 요약)

### Phase 2: AI 콘텐츠 생성 (5주)

- 텍스트 콘텐츠 생성 (채널별 톤 최적화)
- 카드뉴스 랩 (3탭, 3단계 워크플로우)
- AI 대량 기획 (3단계)
- 블로그 생성
- 콘텐츠 리퍼포징 (1소스 → 다중 포맷)

### Phase 3: 캘린더 + 발행 (3주)

- 콘텐츠 캘린더 (캘린더/리스트, 주간/월간)
- node-cron 예약 발행 엔진
- 멀티채널 동시 발행
- 상태 관리 (draft → scheduled → published/failed)

### Phase 4: 관리 + 분석 (3주)

- 댓글/DM 수집 (웹훅 or 폴링)
- AI 자동 응답 + 세일즈 분류 알림
- 성과 대시보드
- AI 리포트 + 인사이트 챗봇

### Phase 5: 숏폼 + 마무리 (3주)

- 숏폼 영상 생성 파이프라인
- 알림 시스템
- 반응형 마무리
- 병원 배포 테스트

**총 예상: ~17주 (풀타임 기준)**

---

## 9. MVP 최소 범위

가장 빠르게 돌아가는 범위:

1. SNS 계정 연동 (Instagram + Threads)
2. AI 텍스트 콘텐츠 생성
3. 콘텐츠 캘린더 + 예약 발행

**→ 약 4~5주로 핵심 루프 완성**

---

## 10. 리스크

| 항목 | 수준 | 대응 |
|------|------|------|
| SNS API 정책 변경 | 높음 | 플랫폼별 어댑터 패턴 분리 |
| 숏폼 영상 생성 비용/품질 | 높음 | 후순위, API 비용 벤치마크 선행 |
| 카드뉴스 디자인 학습 | 높음 | 초기 템플릿 기반, 학습은 점진 도입 |
| 댓글/DM 실시간 처리 | 중간 | 웹훅 우선, 폴백으로 폴링 |
| 병원 방화벽 특정 API 차단 | 낮음 | 허용 확인됨, 필요 시 화이트리스트 요청 |
