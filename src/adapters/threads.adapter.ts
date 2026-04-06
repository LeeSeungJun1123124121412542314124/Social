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
import type {
  TextContent,
  CarouselContent,
  VideoContent,
} from "@/types/content.types";
import type { SocialAccount } from "@/generated/prisma/client";
import { AppError, ErrorCode } from "@/lib/error";
import { decrypt } from "@/lib/encryption";
import { getPlatformOAuthConfig } from "@/config/platforms.config";

export class ThreadsAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "threads";
  private readonly baseUrl = "https://graph.threads.net/v1.0";

  getAuthUrl(state?: string): string {
    const config = getPlatformOAuthConfig("threads");
    if (!config?.clientId) {
      throw new AppError(
        "Threads OAuth가 설정되지 않았습니다.",
        ErrorCode.OAUTH_FAILED,
        500
      );
    }
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
      scope: config.scopes.join(","),
      response_type: "code",
      ...(state ? { state } : {}),
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeToken(code: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("threads");
    if (!config) throw new AppError("Threads 설정 없음", ErrorCode.OAUTH_FAILED);

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.APP_URL}${config.callbackPath}`,
        code,
      }),
    });
    if (!res.ok) {
      throw new AppError("Threads 토큰 교환 실패", ErrorCode.OAUTH_FAILED);
    }
    const data = await res.json() as { access_token: string };
    return { accessToken: data.access_token };
  }

  async refreshToken(_refreshToken: string): Promise<TokenResult> {
    // Threads는 장기 토큰 갱신 방식 사용
    throw new AppError("Threads 토큰 갱신 불필요", ErrorCode.TOKEN_REFRESH_FAILED);
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const params = new URLSearchParams({
      fields: "id,username,threads_profile_picture_url,threads_biography",
      access_token: accessToken,
    });
    const res = await fetch(`${this.baseUrl}/me?${params}`);
    if (!res.ok) throw new AppError("Threads 프로필 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      id: string;
      username: string;
      threads_profile_picture_url?: string;
    };
    return {
      platformUserId: data.id,
      profileName: data.username,
      profileImage: data.threads_profile_picture_url,
      profileUrl: `https://www.threads.net/@${data.username}`,
      followerCount: 0,
    };
  }

  async publishText(
    account: SocialAccount,
    content: TextContent
  ): Promise<PublishResult> {
    const accessToken = decrypt(account.encryptedAccessToken);
    const text = content.hashtags
      ? `${content.text}\n\n${content.hashtags.map((h) => `#${h}`).join(" ")}`
      : content.text;

    try {
      // 1단계: 미디어 컨테이너 생성
      const containerRes = await fetch(
        `${this.baseUrl}/${account.id}/threads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "TEXT",
            text,
            access_token: accessToken,
          }),
        }
      );
      if (!containerRes.ok) throw new Error("컨테이너 생성 실패");
      const containerData = await containerRes.json() as { id: string };

      // 2단계: 발행
      const publishRes = await fetch(
        `${this.baseUrl}/${account.id}/threads_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: accessToken,
          }),
        }
      );
      if (!publishRes.ok) throw new Error("발행 실패");
      const publishData = await publishRes.json() as { id: string };

      return { success: true, platformPostId: publishData.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      };
    }
  }

  async publishCarousel(
    account: SocialAccount,
    content: CarouselContent
  ): Promise<PublishResult> {
    const accessToken = decrypt(account.encryptedAccessToken);

    try {
      const itemIds: string[] = [];
      // imageUrl 없는 슬라이드 제외
      for (const slide of content.slides.filter((s) => s.imageUrl)) {
        const res = await fetch(`${this.baseUrl}/${account.id}/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "IMAGE",
            image_url: slide.imageUrl,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        });
        if (!res.ok) throw new Error("이미지 컨테이너 생성 실패");
        const data = await res.json() as { id: string };
        itemIds.push(data.id);
      }

      const carouselRes = await fetch(`${this.baseUrl}/${account.id}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: itemIds.join(","),
          text: content.caption,
          access_token: accessToken,
        }),
      });
      if (!carouselRes.ok) throw new Error("캐러셀 컨테이너 생성 실패");
      const carouselData = await carouselRes.json() as { id: string };

      const publishRes = await fetch(
        `${this.baseUrl}/${account.id}/threads_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: carouselData.id,
            access_token: accessToken,
          }),
        }
      );
      if (!publishRes.ok) throw new Error("발행 실패");
      const publishData = await publishRes.json() as { id: string };

      return { success: true, platformPostId: publishData.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      };
    }
  }

  async publishVideo(
    _account: SocialAccount,
    _content: VideoContent
  ): Promise<PublishResult> {
    return { success: false, error: "Threads 동영상 발행은 미지원입니다." };
  }

  async getComments(
    account: SocialAccount,
    postId: string
  ): Promise<Comment[]> {
    const accessToken = decrypt(account.encryptedAccessToken);
    const params = new URLSearchParams({
      fields: "id,text,username,timestamp",
      access_token: accessToken,
    });
    const res = await fetch(`${this.baseUrl}/${postId}/replies?${params}`);
    if (!res.ok) return [];

    const data = await res.json() as {
      data: Array<{
        id: string;
        text: string;
        username: string;
        timestamp: string;
      }>;
    };
    return data.data.map((c) => ({
      id: c.id,
      text: c.text,
      authorName: c.username,
      authorId: c.username,
      createdAt: new Date(c.timestamp),
      postId,
    }));
  }

  async replyToComment(
    account: SocialAccount,
    commentId: string,
    text: string
  ): Promise<void> {
    const accessToken = decrypt(account.encryptedAccessToken);
    await fetch(`${this.baseUrl}/${account.id}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text,
        reply_to_id: commentId,
        access_token: accessToken,
      }),
    });
  }

  async getMessages(_account: SocialAccount): Promise<DirectMessage[]> {
    return [];
  }

  async sendMessage(
    _account: SocialAccount,
    _userId: string,
    _text: string
  ): Promise<void> {
    // Threads DM 미지원
  }

  async getPostAnalytics(
    account: SocialAccount,
    postId: string
  ): Promise<AnalyticsData> {
    const accessToken = decrypt(account.encryptedAccessToken);
    const params = new URLSearchParams({
      metric: "views,likes,replies,reposts,quotes",
      access_token: accessToken,
    });
    const res = await fetch(`${this.baseUrl}/${postId}/insights?${params}`);
    if (!res.ok) {
      return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
    }

    const data = await res.json() as {
      data: Array<{ name: string; values: number }>;
    };
    const metrics: Record<string, number> = {};
    for (const m of data.data) {
      metrics[m.name] = m.values;
    }
    return {
      impressions: metrics.views ?? 0,
      reach: metrics.views ?? 0,
      engagement: (metrics.likes ?? 0) + (metrics.replies ?? 0),
      clicks: 0,
      comments: metrics.replies ?? 0,
      shares: (metrics.reposts ?? 0) + (metrics.quotes ?? 0),
      saves: 0,
      likes: metrics.likes ?? 0,
    };
  }

  async getAccountAnalytics(
    _account: SocialAccount,
    dateRange: DateRange
  ): Promise<AccountAnalytics> {
    return {
      platform: "threads",
      dateRange,
      totalImpressions: 0,
      totalReach: 0,
      totalEngagement: 0,
      followerGrowth: 0,
      topPosts: [],
    };
  }
}
