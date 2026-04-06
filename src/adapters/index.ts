import type { PlatformAdapter } from "./platform.adapter";
import type { PlatformType } from "@/types/platform.types";
import { InstagramAdapter } from "./instagram.adapter";
import { ThreadsAdapter } from "./threads.adapter";
import { TikTokAdapter } from "./tiktok.adapter";
import { YouTubeAdapter } from "./youtube.adapter";
import { XAdapter } from "./x.adapter";
import { AppError, ErrorCode } from "@/lib/error";

// 어댑터 싱글톤 인스턴스
const adapters: Record<PlatformType, PlatformAdapter> = {
  instagram: new InstagramAdapter(),
  threads: new ThreadsAdapter(),
  tiktok: new TikTokAdapter(),
  youtube: new YouTubeAdapter(),
  x: new XAdapter(),
};

// 팩토리 함수 - 플랫폼 타입으로 어댑터 가져오기
export function getPlatformAdapter(platform: string): PlatformAdapter {
  const adapter = adapters[platform as PlatformType];
  if (!adapter) {
    throw new AppError(
      `지원하지 않는 플랫폼: ${platform}`,
      ErrorCode.UNSUPPORTED_PLATFORM,
      400
    );
  }
  return adapter;
}

export type { PlatformAdapter };
