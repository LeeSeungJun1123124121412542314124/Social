import type { PlatformAdapter } from "./platform.adapter";
import type {
  PlatformType,
  TokenResult,
  ProfileData,
  PublishResult,
  AnalyticsData,
  AccountAnalytics,
  DateRange,
  Comment,
  DirectMessage,
} from "@/types/platform.types";
import type { TextContent, CarouselContent, VideoContent } from "@/types/content.types";
import type { SocialAccount } from "@/generated/prisma/client";
import { AppError, ErrorCode } from "@/lib/error";
import { decrypt } from "@/lib/encryption";
import { getPlatformOAuthConfig } from "@/config/platforms.config";
export class XAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "x";
  private readonly baseUrl = "https://api.twitter.com/2";

  getAuthUrl(state?: string, codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("x");
    if (!config?.clientId) {
      throw new AppError("X OAuth가 설정되지 않았습니다.", ErrorCode.OAUTH_FAILED, 500);
    }
    if (!codeChallenge) {
      throw new AppError("X OAuth: code_challenge 없음 (PKCE 필수)", ErrorCode.OAUTH_FAILED);
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
      scope: config.scopes.join(" "),
      state: state ?? "state",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeToken(code: string, codeVerifier?: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("x");
    if (!config) throw new AppError("X 설정 없음", ErrorCode.OAUTH_FAILED);
    if (!codeVerifier) throw new AppError("X OAuth: code_verifier 없음", ErrorCode.OAUTH_FAILED);

    // X는 Basic 인증 사용 (clientId:clientSecret을 base64 인코딩)
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

  async getProfile(accessToken: string): Promise<ProfileData> {
    const res = await fetch(
      `${this.baseUrl}/users/me?user.fields=profile_image_url,public_metrics`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new AppError("X 프로필 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
        public_metrics?: { followers_count: number };
      };
    };
    return {
      platformUserId: data.data.id,
      profileName: data.data.username,
      profileImage: data.data.profile_image_url,
      profileUrl: `https://x.com/${data.data.username}`,
      followerCount: data.data.public_metrics?.followers_count ?? 0,
    };
  }

  async publishText(account: SocialAccount, content: TextContent): Promise<PublishResult> {
    const token = decrypt(account.encryptedAccessToken);
    const text = content.hashtags
      ? `${content.text}\n\n${content.hashtags.map((h) => `#${h}`).join(" ")}`
      : content.text;

    const res = await fetch(`${this.baseUrl}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
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

  async publishCarousel(
    _account: SocialAccount,
    _content: CarouselContent
  ): Promise<PublishResult> {
    return { success: false, error: "X 카드뉴스 발행: 이미지 첨부는 미구현 (텍스트만 지원)" };
  }

  async publishVideo(
    _account: SocialAccount,
    _content: VideoContent
  ): Promise<PublishResult> {
    return { success: false, error: "X 영상 발행: 미디어 업로드 API 별도 구현 필요" };
  }

  async getComments(
    _account: SocialAccount,
    _postId: string
  ): Promise<Comment[]> { return []; }

  async replyToComment(
    _account: SocialAccount,
    _commentId: string,
    _text: string
  ): Promise<void> {}

  async getMessages(_account: SocialAccount): Promise<DirectMessage[]> { return []; }

  async sendMessage(
    _account: SocialAccount,
    _userId: string,
    _text: string
  ): Promise<void> {}

  async getPostAnalytics(
    _account: SocialAccount,
    _postId: string
  ): Promise<AnalyticsData> {
    return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
  }

  async getAccountAnalytics(
    _account: SocialAccount,
    dateRange: DateRange
  ): Promise<AccountAnalytics> {
    return { platform: "x", dateRange, totalImpressions: 0, totalReach: 0, totalEngagement: 0, followerGrowth: 0, topPosts: [] };
  }
}
