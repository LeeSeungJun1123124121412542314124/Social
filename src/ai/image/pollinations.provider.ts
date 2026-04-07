// src/ai/image/pollinations.provider.ts
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";
import { saveRemoteImage } from "@/lib/file-upload";

export class PollinationsProvider implements ImageProvider {
  readonly name = "pollinations";

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const count = options?.count ?? 1;
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;

    const encodedPrompt = encodeURIComponent(prompt);
    const urls: string[] = [];

    for (let i = 0; i < count; i++) {
      // seed를 랜덤으로 부여해 count만큼 다른 이미지 생성
      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

      const localPath = await saveRemoteImage(url, "carousel");
      urls.push(localPath);
    }

    return { urls };
  }
}
