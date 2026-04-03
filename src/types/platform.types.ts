export type PlatformType =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "threads"
  | "x";

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ProfileData {
  platformUserId: string;
  profileName: string;
  profileImage?: string;
  profileUrl?: string;
  followerCount: number;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  url?: string;
  error?: string;
}

export interface AnalyticsData {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  comments: number;
  shares: number;
  saves: number;
  likes: number;
}

export interface AccountAnalytics {
  platform: PlatformType;
  dateRange: DateRange;
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  followerGrowth: number;
  topPosts: string[]; // platformPostId 목록
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface Comment {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  createdAt: Date;
  postId: string;
}

export interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
  isFromMe: boolean;
}
