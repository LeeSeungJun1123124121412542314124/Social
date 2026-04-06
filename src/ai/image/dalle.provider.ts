// src/ai/image/dalle.provider.ts
import OpenAI from "openai";
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";
import { saveRemoteImage } from "@/lib/file-upload";

export class DalleProvider implements ImageProvider {
  readonly name = "dalle";
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const count = options?.count ?? 1;
    const size = this.resolveSize(options?.width, options?.height);

    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1, // dall-e-3는 n=1만 지원, 여러 장은 반복 호출
      size,
      response_format: "url",
    });

    // 여러 장 요청 시 순차 생성
    const urls: string[] = [];
    for (let i = 0; i < count; i++) {
      const res = i === 0
        ? response
        : await this.client.images.generate({
            model: "dall-e-3",
            prompt,
            n: 1,
            size,
            response_format: "url",
          });

      const remoteUrl = res.data?.[0]?.url;
      if (!remoteUrl) throw new Error("DALL-E 이미지 URL 없음");

      // 로컬에 저장 (dall-e URL은 1시간 후 만료)
      const localPath = await saveRemoteImage(remoteUrl, "carousel");
      urls.push(localPath);
    }

    return { urls };
  }

  private resolveSize(w?: number, h?: number): "1024x1024" | "1792x1024" | "1024x1792" {
    if (w && h && w > h) return "1792x1024";
    if (w && h && h > w) return "1024x1792";
    return "1024x1024";
  }
}
