import type { PlatformType } from "@/types/platform.types";

export const PLATFORMS: Record<
  PlatformType,
  {
    name: string;
    icon: string;
    color: string;
    maxTextLength: number;
  }
> = {
  instagram: {
    name: "Instagram",
    icon: "/icons/instagram.svg",
    color: "#E4405F",
    maxTextLength: 2200,
  },
  tiktok: {
    name: "TikTok",
    icon: "/icons/tiktok.svg",
    color: "#000000",
    maxTextLength: 4000,
  },
  youtube: {
    name: "YouTube",
    icon: "/icons/youtube.svg",
    color: "#FF0000",
    maxTextLength: 5000,
  },
  threads: {
    name: "Threads",
    icon: "/icons/threads.svg",
    color: "#000000",
    maxTextLength: 500,
  },
  x: {
    name: "X",
    icon: "/icons/x.svg",
    color: "#000000",
    maxTextLength: 280,
  },
};

export const PLATFORM_TYPES: PlatformType[] = [
  "instagram",
  "tiktok",
  "youtube",
  "threads",
  "x",
];

export const POST_STATUS = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  FAILED: "failed",
  PARTIAL: "partial",
} as const;

export const POST_STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  scheduled: "예약됨",
  publishing: "발행중",
  published: "발행완료",
  failed: "실패",
  partial: "부분성공",
};

export const POST_STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  scheduled: "default",
  publishing: "default",
  published: "default",
  failed: "destructive",
  partial: "secondary",
};

export const CONTENT_TYPES = {
  TEXT: "text",
  CAROUSEL: "carousel",
  BLOG: "blog",
  SHORT_FORM: "short_form",
  THREAD: "thread",
} as const;

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: "텍스트",
  carousel: "카드뉴스",
  blog: "블로그",
  short_form: "숏폼 영상",
  thread: "스레드",
};
