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

// 플랫폼 어댑터 공통 인터페이스
// 모든 SNS 플랫폼 어댑터는 이 인터페이스를 구현해야 함.
// 플랫폼 API 변경 시 해당 adapter 파일 1개만 수정하면 됨.
export interface PlatformAdapter {
  readonly platform: PlatformType;

  // OAuth
  getAuthUrl(state?: string, codeChallenge?: string): string;
  exchangeToken(code: string, codeVerifier?: string): Promise<TokenResult>;
  refreshToken(refreshToken: string): Promise<TokenResult>;

  // 프로필
  getProfile(accessToken: string): Promise<ProfileData>;

  // 발행
  publishText(
    account: SocialAccount,
    content: TextContent
  ): Promise<PublishResult>;
  publishCarousel(
    account: SocialAccount,
    content: CarouselContent
  ): Promise<PublishResult>;
  publishVideo(
    account: SocialAccount,
    content: VideoContent
  ): Promise<PublishResult>;

  // 인게이지먼트
  getComments(
    account: SocialAccount,
    postId: string
  ): Promise<Comment[]>;
  replyToComment(
    account: SocialAccount,
    commentId: string,
    text: string
  ): Promise<void>;
  getMessages(account: SocialAccount): Promise<DirectMessage[]>;
  sendMessage(
    account: SocialAccount,
    userId: string,
    text: string
  ): Promise<void>;

  // 분석
  getPostAnalytics(
    account: SocialAccount,
    postId: string
  ): Promise<AnalyticsData>;
  getAccountAnalytics(
    account: SocialAccount,
    dateRange: DateRange
  ): Promise<AccountAnalytics>;
}
