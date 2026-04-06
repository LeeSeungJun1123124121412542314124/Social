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

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "instagram";
  private readonly baseUrl = "https://graph.instagram.com/v21.0";

  getAuthUrl(state?: string, _codeChallenge?: string): string {
    const config = getPlatformOAuthConfig("instagram");
    if (!config?.clientId) {
      throw new AppError(
        "Instagram OAuth가 설정되지 않았습니다.",
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

  async exchangeToken(code: string, _codeVerifier?: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("instagram");
    if (!config) throw new AppError("Instagram 설정 없음", ErrorCode.OAUTH_FAILED);

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
      const err = await res.text();
      throw new AppError(`토큰 교환 실패: ${err}`, ErrorCode.OAUTH_FAILED);
    }

    const data = await res.json() as { access_token: string; token_type: string };
    // 단기 토큰 → 장기 토큰으로 교환
    return this.exchangeToLongLivedToken(data.access_token);
  }

  private async exchangeToLongLivedToken(shortToken: string): Promise<TokenResult> {
    const config = getPlatformOAuthConfig("instagram");
    if (!config) throw new AppError("Instagram 설정 없음", ErrorCode.OAUTH_FAILED);

    const params = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: config.clientSecret,
      access_token: shortToken,
    });
    const res = await fetch(
      `${this.baseUrl}/access_token?${params.toString()}`
    );
    if (!res.ok) throw new AppError("장기 토큰 교환 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    return { accessToken: data.access_token, expiresAt };
  }

  async refreshToken(accessToken: string): Promise<TokenResult> {
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    });
    const res = await fetch(`${this.baseUrl}/refresh_access_token?${params}`);
    if (!res.ok) {
      throw new AppError("토큰 갱신 실패", ErrorCode.TOKEN_REFRESH_FAILED);
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    return { accessToken: data.access_token, expiresAt };
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const params = new URLSearchParams({
      fields: "id,username,profile_picture_url,followers_count",
      access_token: accessToken,
    });
    const res = await fetch(`${this.baseUrl}/me?${params}`);
    if (!res.ok) throw new AppError("프로필 조회 실패", ErrorCode.OAUTH_FAILED);

    const data = await res.json() as {
      id: string;
      username: string;
      profile_picture_url?: string;
      followers_count?: number;
    };
    return {
      platformUserId: data.id,
      profileName: data.username,
      profileImage: data.profile_picture_url,
      profileUrl: `https://www.instagram.com/${data.username}`,
      followerCount: data.followers_count ?? 0,
    };
  }

  async publishText(account: SocialAccount, content: TextContent): Promise<PublishResult> {
    const accessToken = decrypt(account.encryptedAccessToken);
    // Instagram은 텍스트 단독 발행을 지원하지 않음 → 이미지 없는 경우 에러
    // 실제 텍스트 전용 발행은 Threads로 유도
    throw new AppError(
      "Instagram은 텍스트 단독 발행을 지원하지 않습니다. 카드뉴스나 이미지를 함께 사용하세요.",
      ErrorCode.PUBLISH_FAILED,
      400
    );
    // void accessToken; void content; // unused vars silencer
  }

  async publishCarousel(
    account: SocialAccount,
    content: CarouselContent
  ): Promise<PublishResult> {
    const accessToken = decrypt(account.encryptedAccessToken);

    try {
      // 1단계: 각 이미지 컨테이너 생성 (imageUrl 없는 슬라이드 제외)
      const containerIds: string[] = [];
      for (const slide of content.slides.filter((s) => s.imageUrl)) {
        const res = await fetch(
          `${this.baseUrl}/${account.id}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: slide.imageUrl,
              is_carousel_item: true,
              access_token: accessToken,
            }),
          }
        );
        if (!res.ok) throw new Error("이미지 컨테이너 생성 실패");
        const data = await res.json() as { id: string };
        containerIds.push(data.id);
      }

      // 2단계: 캐러셀 컨테이너 생성
      const carouselRes = await fetch(
        `${this.baseUrl}/${account.id}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            children: containerIds.join(","),
            caption: content.caption,
            access_token: accessToken,
          }),
        }
      );
      if (!carouselRes.ok) throw new Error("캐러셀 컨테이너 생성 실패");
      const carouselData = await carouselRes.json() as { id: string };

      // 3단계: 발행
      const publishRes = await fetch(
        `${this.baseUrl}/${account.id}/media_publish`,
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

      return {
        success: true,
        platformPostId: publishData.id,
        url: `https://www.instagram.com/p/${publishData.id}/`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      };
    }
  }

  async publishVideo(
    account: SocialAccount,
    content: VideoContent
  ): Promise<PublishResult> {
    const accessToken = decrypt(account.encryptedAccessToken);

    try {
      // Reels 발행
      const initRes = await fetch(`${this.baseUrl}/${account.id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: content.videoUrl,
          caption: content.description,
          access_token: accessToken,
        }),
      });
      if (!initRes.ok) throw new Error("영상 컨테이너 생성 실패");
      const initData = await initRes.json() as { id: string };

      // 상태 확인 후 발행 (업로드 완료 대기 필요)
      const publishRes = await fetch(
        `${this.baseUrl}/${account.id}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: initData.id,
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

  async getComments(account: SocialAccount, postId: string): Promise<Comment[]> {
    const accessToken = decrypt(account.encryptedAccessToken);
    const params = new URLSearchParams({
      fields: "id,text,username,timestamp",
      access_token: accessToken,
    });
    const res = await fetch(`${this.baseUrl}/${postId}/comments?${params}`);
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
    await fetch(`${this.baseUrl}/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, access_token: accessToken }),
    });
  }

  async getMessages(_account: SocialAccount): Promise<DirectMessage[]> {
    // Instagram DM은 별도 Instagram Messaging API 필요
    return [];
  }

  async sendMessage(
    _account: SocialAccount,
    _userId: string,
    _text: string
  ): Promise<void> {
    // Instagram DM 발송 - Messaging API 필요
  }

  async getPostAnalytics(
    account: SocialAccount,
    postId: string
  ): Promise<AnalyticsData> {
    const accessToken = decrypt(account.encryptedAccessToken);
    const params = new URLSearchParams({
      metric: "impressions,reach,engagement,saved,likes,comments,shares",
      access_token: accessToken,
    });
    const res = await fetch(
      `${this.baseUrl}/${postId}/insights?${params}`
    );
    if (!res.ok) {
      return { impressions: 0, reach: 0, engagement: 0, clicks: 0, comments: 0, shares: 0, saves: 0, likes: 0 };
    }

    const data = await res.json() as {
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    };
    const metrics: Record<string, number> = {};
    for (const m of data.data) {
      metrics[m.name] = m.values[0]?.value ?? 0;
    }
    return {
      impressions: metrics.impressions ?? 0,
      reach: metrics.reach ?? 0,
      engagement: metrics.engagement ?? 0,
      clicks: 0,
      comments: metrics.comments ?? 0,
      shares: metrics.shares ?? 0,
      saves: metrics.saved ?? 0,
      likes: metrics.likes ?? 0,
    };
  }

  async getAccountAnalytics(
    account: SocialAccount,
    dateRange: DateRange
  ): Promise<AccountAnalytics> {
    const accessToken = decrypt(account.encryptedAccessToken);
    const params = new URLSearchParams({
      metric: "impressions,reach,follower_count",
      period: "day",
      since: Math.floor(dateRange.from.getTime() / 1000).toString(),
      until: Math.floor(dateRange.to.getTime() / 1000).toString(),
      access_token: accessToken,
    });
    const res = await fetch(
      `${this.baseUrl}/${account.id}/insights?${params}`
    );

    if (!res.ok) {
      return {
        platform: "instagram",
        dateRange,
        totalImpressions: 0,
        totalReach: 0,
        totalEngagement: 0,
        followerGrowth: 0,
        topPosts: [],
      };
    }

    const data = await res.json() as {
      data: Array<{
        name: string;
        values: Array<{ value: number; end_time: string }>;
      }>;
    };

    const sum = (name: string) =>
      data.data
        .find((m) => m.name === name)
        ?.values.reduce((acc, v) => acc + v.value, 0) ?? 0;

    return {
      platform: "instagram",
      dateRange,
      totalImpressions: sum("impressions"),
      totalReach: sum("reach"),
      totalEngagement: 0,
      followerGrowth: sum("follower_count"),
      topPosts: [],
    };
  }
}
