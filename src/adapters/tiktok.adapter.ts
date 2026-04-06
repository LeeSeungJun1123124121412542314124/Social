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

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "tiktok";
  private readonly baseUrl = "https://open.tiktokapis.com/v2";

  getAuthUrl(state?: string, codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("tiktok");
    if (!config?.clientId) {
      throw new AppError("TikTok OAuth가 설정되지 않았습니다.", ErrorCode.OAUTH_FAILED, 500);
    }

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
    const data = await res.json() as {
      data: { access_token: string; refresh_token: string; expires_in: number };
    };
    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
    };
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const res = await fetch(
      `${this.baseUrl}/user/info/?fields=open_id,display_name,avatar_url,username`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new AppError("TikTok 프로필 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      data: {
        user: {
          open_id: string;
          display_name: string;
          username?: string;
          avatar_url?: string;
        };
      };
    };
    const user = data.data.user;
    return {
      platformUserId: user.open_id,
      profileName: user.username ?? user.open_id,
      profileImage: user.avatar_url,
      profileUrl: user.username ? `https://www.tiktok.com/@${user.username}` : undefined,
      followerCount: 0,
    };
  }

  async publishText(
    _account: SocialAccount,
    _content: TextContent
  ): Promise<PublishResult> {
    return { success: false, error: "TikTok은 텍스트 전용 게시물을 지원하지 않습니다. 영상을 업로드하세요." };
  }

  async publishCarousel(
    _account: SocialAccount,
    _content: CarouselContent
  ): Promise<PublishResult> {
    return { success: false, error: "TikTok 카드뉴스: 사진 슬라이드쇼 API는 Phase 4에서 구현됩니다." };
  }

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

    // 2단계: 영상 업로드
    const fs = await import("fs/promises");
    const path = await import("path");
    const videoPath = path.join(process.cwd(), "public", content.videoUrl);
    // TODO(Phase 4): 대용량 영상 지원 시 스트리밍 업로드로 교체 필요
    const videoBuffer = await fs.readFile(videoPath);

    const uploadRes = await fetch(initData.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      return { success: false, error: "TikTok 영상 업로드 실패" };
    }

    // 3단계: 발행
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

  async getPostAnalytics(account: SocialAccount, postId: string): Promise<AnalyticsData> {
    const token = decrypt(account.encryptedAccessToken);
    const filters = encodeURIComponent(JSON.stringify({ video_ids: [postId] }));
    const res = await fetch(
      `${this.baseUrl}/video/query/?fields=id,statistics&filters=${filters}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
    }

    const data = await res.json() as {
      data: {
        videos: Array<{
          statistics: {
            play_count: number;
            like_count: number;
            comment_count: number;
            share_count: number;
          };
        }>;
      };
    };
    const stats = data.data.videos[0]?.statistics;
    if (!stats) {
      return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
    }

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

  async getAccountAnalytics(
    _account: SocialAccount,
    dateRange: DateRange
  ): Promise<AccountAnalytics> {
    return { platform: "tiktok", dateRange, totalImpressions: 0, totalReach: 0, totalEngagement: 0, followerGrowth: 0, topPosts: [] };
  }
}
