# SNS OAuth 설정 가이드

각 플랫폼 개발자 콘솔에서 앱을 등록하고, 발급받은 자격 증명을 `.env` 파일에 입력하면 SNS 연동이 활성화됩니다.

---

## 사전 준비

### 1. 암호화 키 생성

토큰을 AES-256-GCM으로 암호화 저장하는 데 사용됩니다. 반드시 32자 이상의 랜덤 문자열을 사용하세요.

```bash
openssl rand -base64 32
```

생성된 값을 `.env`의 `ENCRYPTION_KEY`에 입력합니다.

### 2. 콜백 URL 패턴

모든 플랫폼의 콜백 URL은 아래 패턴을 따릅니다:

```
{APP_URL}/api/accounts/callback/{platform}
```

| 플랫폼 | 콜백 URL (로컬) |
|--------|----------------|
| Instagram | `http://localhost:3000/api/accounts/callback/instagram` |
| Threads | `http://localhost:3000/api/accounts/callback/threads` |
| TikTok | `http://localhost:3000/api/accounts/callback/tiktok` |
| YouTube | `http://localhost:3000/api/accounts/callback/youtube` |
| X | `http://localhost:3000/api/accounts/callback/x` |

프로덕션 배포 시 `APP_URL`을 실제 도메인으로 변경하고, 각 플랫폼 개발자 콘솔에 프로덕션 콜백 URL을 추가로 등록해야 합니다.

---

## Instagram

> Graph API를 사용하므로 **비즈니스 계정 또는 크리에이터 계정**에서만 동작합니다.

### 앱 등록 절차

1. [Meta for Developers](https://developers.facebook.com/apps/) 접속
2. **앱 만들기** → 앱 유형: **비즈니스**
3. 왼쪽 메뉴 → **Instagram 기본 표시** 추가
4. **앱 설정 → 기본** 메뉴에서 앱 ID와 앱 시크릿 코드 확인
5. **Instagram → API 설정 → 리디렉션 URI** 에 콜백 URL 등록:
   ```
   http://localhost:3000/api/accounts/callback/instagram
   ```

### 필수 권한 (Scopes)

앱 검수 전에는 본인 계정으로만 테스트 가능합니다.

| 권한 | 용도 |
|------|------|
| `instagram_basic` | 프로필 조회 |
| `instagram_content_publish` | 피드/릴스 발행 |
| `instagram_manage_comments` | 댓글 조회 및 답글 |
| `instagram_manage_messages` | DM 수신 (검수 필요) |

### `.env` 설정

```env
INSTAGRAM_CLIENT_ID="앱 ID"
INSTAGRAM_CLIENT_SECRET="앱 시크릿 코드"
```

---

## Threads

> Instagram과 동일한 Meta 개발자 계정을 사용합니다. 기존 Instagram 앱에 Threads API를 추가하거나 별도 앱을 생성할 수 있습니다.

### 앱 등록 절차

1. [Meta for Developers](https://developers.facebook.com/apps/) 접속
2. 기존 앱 선택 또는 새 앱 생성 (비즈니스 유형)
3. 왼쪽 메뉴 → **Threads API** 추가
4. **Threads → 설정 → 리디렉션 URI** 에 콜백 URL 등록:
   ```
   http://localhost:3000/api/accounts/callback/threads
   ```
5. **앱 설정 → 기본** 에서 앱 ID와 앱 시크릿 코드 확인

### 필수 권한 (Scopes)

| 권한 | 용도 |
|------|------|
| `threads_basic` | 프로필 조회 |
| `threads_content_publish` | 게시물 발행 |
| `threads_manage_replies` | 댓글 조회 및 답글 |

### `.env` 설정

```env
THREADS_CLIENT_ID="앱 ID"
THREADS_CLIENT_SECRET="앱 시크릿 코드"
```

---

## TikTok

> PKCE(Proof Key for Code Exchange) 방식을 사용합니다. 코드에서 자동으로 처리됩니다.

### 앱 등록 절차

1. [TikTok for Developers](https://developers.tiktok.com/) 접속 → 로그인
2. **My Apps** → **Create App**
3. 앱 카테고리: **Web**, 플랫폼: **Web**
4. **Products** → **Login Kit** 추가
5. **Redirect URI** 에 콜백 URL 등록:
   ```
   http://localhost:3000/api/accounts/callback/tiktok
   ```
6. **App Key**와 **App Secret** 확인

### 필수 권한 (Scopes)

| 권한 | 용도 |
|------|------|
| `user.info.basic` | 프로필 조회 |
| `video.publish` | 동영상 발행 |
| `video.list` | 영상 목록/통계 조회 |

### `.env` 설정

```env
TIKTOK_CLIENT_KEY="App Key"
TIKTOK_CLIENT_SECRET="App Secret"
```

---

## YouTube (Google)

> YouTube Data API v3를 사용합니다. Google Cloud Console에서 프로젝트를 생성하고 API를 활성화해야 합니다.

### 앱 등록 절차

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **APIs & Services → Library** → `YouTube Data API v3` 검색 후 활성화
4. **APIs & Services → OAuth 동의 화면** 설정:
   - 사용자 유형: **외부**
   - 앱 이름, 이메일 입력
   - 스코프에 아래 3개 추가
5. **APIs & Services → 사용자 인증 정보** → **OAuth 클라이언트 ID 만들기**:
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 리디렉션 URI에 콜백 URL 추가:
     ```
     http://localhost:3000/api/accounts/callback/youtube
     ```
6. 클라이언트 ID와 클라이언트 보안 비밀 복사

### 필수 스코프

| 스코프 | 용도 |
|--------|------|
| `https://www.googleapis.com/auth/youtube.upload` | 동영상 업로드 |
| `https://www.googleapis.com/auth/youtube.readonly` | 채널/통계 조회 |
| `https://www.googleapis.com/auth/youtube.force-ssl` | 댓글 관리 |

### `.env` 설정

```env
YOUTUBE_CLIENT_ID="클라이언트 ID"
YOUTUBE_CLIENT_SECRET="클라이언트 보안 비밀"
```

---

## X (Twitter)

> OAuth 2.0 + PKCE 방식을 사용합니다. **Basic Plan 이상**의 개발자 계정이 필요합니다.

### 앱 등록 절차

1. [Twitter Developer Portal](https://developer.twitter.com/) 접속
2. **Projects & Apps** → **New Project** 또는 기존 프로젝트에 **New App** 추가
3. App 생성 후 **Settings** → **User authentication settings** 클릭
4. 아래와 같이 설정:
   - OAuth 2.0 활성화: **On**
   - App type: **Web App**
   - Callback URI:
     ```
     http://localhost:3000/api/accounts/callback/x
     ```
   - Website URL: `http://localhost:3000`
5. **Keys and tokens** 탭에서 **API Key**, **API Key Secret**, **Access Token**, **Access Token Secret** 확인

### 필수 스코프

| 스코프 | 용도 |
|--------|------|
| `tweet.read` | 트윗 조회 |
| `tweet.write` | 트윗 발행 |
| `users.read` | 프로필 조회 |
| `offline.access` | 리프레시 토큰 발급 |

### `.env` 설정

```env
X_API_KEY="API Key"
X_API_SECRET="API Key Secret"
X_ACCESS_TOKEN="Access Token"
X_ACCESS_SECRET="Access Token Secret"
```

---

## 전체 `.env` 설정 예시

```env
# ===== 앱 설정 =====
APP_URL="http://localhost:3000"
ENCRYPTION_KEY="openssl rand -base64 32 으로 생성한 값"

# ===== SNS OAuth =====
# Instagram/Threads: https://developers.facebook.com/apps/
INSTAGRAM_CLIENT_ID=""
INSTAGRAM_CLIENT_SECRET=""
THREADS_CLIENT_ID=""
THREADS_CLIENT_SECRET=""

# TikTok: https://developers.tiktok.com/
TIKTOK_CLIENT_KEY=""
TIKTOK_CLIENT_SECRET=""

# YouTube: https://console.cloud.google.com/
YOUTUBE_CLIENT_ID=""
YOUTUBE_CLIENT_SECRET=""

# X (Twitter): https://developer.twitter.com/
X_API_KEY=""
X_API_SECRET=""
X_ACCESS_TOKEN=""
X_ACCESS_SECRET=""
```

---

## 연동 확인

1. 서버 재시작: `npm run dev`
2. `/accounts` 페이지에서 자격 증명이 입력된 플랫폼 버튼만 표시됨
3. 플랫폼 버튼 클릭 → 해당 플랫폼 OAuth 인증 페이지로 리다이렉트
4. 인증 완료 후 `/accounts?success=connected` 로 돌아오면 성공

> `getAvailablePlatforms()` 함수가 `clientId`가 비어 있는 플랫폼을 자동으로 숨깁니다. 설정한 플랫폼만 UI에 표시됩니다.
