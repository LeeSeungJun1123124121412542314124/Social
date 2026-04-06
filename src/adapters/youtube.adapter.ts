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

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "youtube";

  getAuthUrl(state?: string, _codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("youtube");
    if (!config?.clientId) {
      throw new AppError("YouTube OAuth가 설정되지 않았습니다.", ErrorCode.OAUTH_FAILED, 500);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
      response_type: "code",
      scope: config.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
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
      refreshToken,
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
        snippet: {
          title: string;
          customUrl?: string;
          thumbnails?: { default?: { url: string } };
        };
        statistics?: { subscriberCount?: string };
      }>;
    };
    const channel = data.items[0];
    if (!channel) throw new AppError("YouTube 채널 없음", ErrorCode.OAUTH_FAILED);

    return {
      platformUserId: channel.id,
      profileName: channel.snippet.customUrl ?? channel.id,
      profileImage: channel.snippet.thumbnails?.default?.url,
      profileUrl: channel.snippet.customUrl
        ? `https://www.youtube.com/${channel.snippet.customUrl}`
        : `https://www.youtube.com/channel/${channel.id}`,
      followerCount: channel.statistics?.subscriberCount
        ? parseInt(channel.statistics.subscriberCount)
        : 0,
    };
  }

  async publishText(
    _account: SocialAccount,
    _content: TextContent
  ): Promise<PublishResult> {
    return { success: false, error: "YouTube는 텍스트 전용 게시물을 지원하지 않습니다." };
  }

  async publishCarousel(
    _account: SocialAccount,
    _content: CarouselContent
  ): Promise<PublishResult> {
    return { success: false, error: "YouTube는 카드뉴스를 지원하지 않습니다." };
  }

  async publishVideo(account: SocialAccount, content: VideoContent): Promise<PublishResult> {
    const token = decrypt(account.encryptedAccessToken);

    // 1단계: 재개 가능 업로드 초기화
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

    // 2단계: 영상 업로드
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
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${postId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
    }

    const data = await res.json() as {
      items: Array<{
        statistics: {
          viewCount: string;
          likeCount: string;
          commentCount: string;
          favoriteCount: string;
        };
      }>;
    };
    const stats = data.items[0]?.statistics;
    if (!stats) {
      return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
    }

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

  async getAccountAnalytics(
    _account: SocialAccount,
    dateRange: DateRange
  ): Promise<AccountAnalytics> {
    return { platform: "youtube", dateRange, totalImpressions: 0, totalReach: 0, totalEngagement: 0, followerGrowth: 0, topPosts: [] };
  }
}
