import type { PlatformType } from "./platform.types";

export type ContentType =
  | "text"
  | "carousel"
  | "blog"
  | "short_form"
  | "thread";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "partial";

// 플랫폼별 콘텐츠 포맷
export interface TextContent {
  text: string;
  hashtags?: string[];
}

export interface CarouselSlide {
  imageUrl?: string;
  text?: string;
  order: number;
}

export interface CarouselContent {
  slides: CarouselSlide[];
  caption?: string;
  hashtags?: string[];
}

export interface VideoContent {
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  hashtags?: string[];
}

export interface BlogContent {
  title: string;
  body: string;
  excerpt?: string;
  tags?: string[];
}

// AI 생성 입력 타입
export interface GenerateTextInput {
  topic: string;
  platform: PlatformType;
  tone?: string;
  length?: "short" | "medium" | "long";
  additionalContext?: string;
}

export interface GenerateCarouselInput {
  topic: string;
  slideCount?: number;
  style?: string;
  additionalContext?: string;
}

export interface GenerateBlogInput {
  topic: string;
  targetLength?: number;
  keywords?: string[];
  additionalContext?: string;
}

export interface RepurposeInput {
  sourceType: "blog" | "video" | "idea" | "script";
  sourceContent: string;
  targetFormats: ContentType[];
  targetPlatforms?: PlatformType[];
}

// AI 생성 결과 타입
export interface GeneratedText {
  text: string;
  platform: PlatformType;
  characterCount: number;
  hashtags?: string[];
}

export interface GeneratedCarousel {
  slides: CarouselSlide[];
  caption: string;
}

export interface GeneratedBlog {
  title: string;
  body: string;
  excerpt: string;
  tags: string[];
  wordCount: number;
}

// BulkPlan 타입 (Task B2에서 사용)
export interface BulkIdeaItem {
  title: string;
  topic: string;
  platform: PlatformType;
  contentType: ContentType;
  suggestedTone: string;
  hashtags: string[];
}

export interface BulkPlan {
  theme: string;
  ideas: BulkIdeaItem[];
}

export interface BulkInput {
  theme: string;
  count: number;
  platforms: PlatformType[];
  period?: string;
}

// RepurposeResult 타입 (Task B3에서 사용)
export interface RepurposeResult {
  format: ContentType;
  platform?: PlatformType;
  title?: string;
  text: string;
  hashtags?: string[];
}
