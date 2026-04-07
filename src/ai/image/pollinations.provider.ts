// src/ai/image/pollinations.provider.ts
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";

export class PollinationsProvider implements ImageProvider {
  readonly name = "pollinations";

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const count = options?.count ?? 1;
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;

    const urls: string[] = [];
    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 1_000_000);
      const encodedPrompt = encodeURIComponent(prompt.substring(0, 300));
      // 이미지를 다운로드하지 않고 URL을 직접 반환 — 브라우저가 로드
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;
      urls.push(url);
    }

    return { urls };
  }
}
