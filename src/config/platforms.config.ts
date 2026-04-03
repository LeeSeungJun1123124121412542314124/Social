import type { PlatformType } from "@/types/platform.types";

interface PlatformOAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  callbackPath: string;
}

// 각 플랫폼 OAuth 설정 (환경변수에서 읽기)
function buildPlatformConfigs(): Partial<Record<PlatformType, PlatformOAuthConfig>> {
  return {
    instagram: {
      clientId: process.env.INSTAGRAM_CLIENT_ID ?? "",
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET ?? "",
      authUrl: "https://www.instagram.com/oauth/authorize",
      tokenUrl: "https://api.instagram.com/oauth/access_token",
      scopes: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_messages",
      ],
      callbackPath: "/accounts/connect/instagram/callback",
    },
    threads: {
      clientId: process.env.THREADS_CLIENT_ID ?? "",
      clientSecret: process.env.THREADS_CLIENT_SECRET ?? "",
      authUrl: "https://threads.net/oauth/authorize",
      tokenUrl: "https://graph.threads.net/oauth/access_token",
      scopes: [
        "threads_basic",
        "threads_content_publish",
        "threads_manage_replies",
      ],
      callbackPath: "/accounts/connect/threads/callback",
    },
    tiktok: {
      clientId: process.env.TIKTOK_CLIENT_KEY ?? "",
      clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      authUrl: "https://www.tiktok.com/v2/auth/authorize/",
      tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
      scopes: ["user.info.basic", "video.publish", "video.list"],
      callbackPath: "/accounts/connect/tiktok/callback",
    },
    youtube: {
      clientId: process.env.YOUTUBE_CLIENT_ID ?? "",
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.force-ssl",
      ],
      callbackPath: "/accounts/connect/youtube/callback",
    },
    x: {
      clientId: process.env.X_API_KEY ?? "",
      clientSecret: process.env.X_API_SECRET ?? "",
      authUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      callbackPath: "/accounts/connect/x/callback",
    },
  };
}

export function getPlatformOAuthConfig(
  platform: PlatformType
): PlatformOAuthConfig | undefined {
  return buildPlatformConfigs()[platform];
}

// 현재 OAuth 설정이 있는 플랫폼 목록
export function getAvailablePlatforms(): PlatformType[] {
  const configs = buildPlatformConfigs();
  return (Object.entries(configs) as [PlatformType, PlatformOAuthConfig][])
    .filter(([, config]) => config?.clientId)
    .map(([platform]) => platform);
}
