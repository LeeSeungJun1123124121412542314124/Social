import type { ImageOptions, ImageResult } from "@/types/ai.types";

// 이미지 생성 provider 공통 인터페이스
export interface ImageProvider {
  readonly name: string;
  generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult>;
}
