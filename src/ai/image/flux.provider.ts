// src/ai/image/flux.provider.ts
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";
import { saveRemoteImage } from "@/lib/file-upload";

// fal-ai/flux/dev image_size 허용 값
type FluxImageSize = "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";

export class FluxProvider implements ImageProvider {
  readonly name = "flux";

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    // fal.ai 동적 import (서버 사이드 전용)
    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: process.env.FAL_KEY ?? "" });

    const count = options?.count ?? 1;
    const imageSize = this.resolveSize(options?.width, options?.height);

    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        num_images: count,
        image_size: imageSize,
      },
    });

    const urls: string[] = [];
    for (const img of result.data.images) {
      const localPath = await saveRemoteImage(img.url, "carousel");
      urls.push(localPath);
    }

    return { urls };
  }

  private resolveSize(w?: number, h?: number): FluxImageSize {
    if (w && h && w > h) return "landscape_16_9";
    if (w && h && h > w) return "portrait_16_9";
    return "square_hd";
  }
}
