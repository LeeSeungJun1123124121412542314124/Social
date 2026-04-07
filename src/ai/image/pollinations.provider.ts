// src/ai/image/pollinations.provider.ts
import type { ImageProvider } from "./image.provider";
import type { ImageOptions, ImageResult } from "@/types/ai.types";
import { saveRemoteImage } from "@/lib/file-upload";
import { AppError, ErrorCode } from "@/lib/error";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 4000;

async function fetchWithRetry(url: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      // 직접 saveRemoteImage 대신 여기서 처리
      const buffer = Buffer.from(await res.arrayBuffer());
      const { writeFile, mkdir } = await import("fs/promises");
      const { join } = await import("path");
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const dir = join(process.cwd(), "public", "uploads", "carousel");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), buffer);
      return `/uploads/carousel/${name}`;
    }
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      continue;
    }
    throw new AppError(
      `Pollinations 이미지 생성 실패 (${res.status}). 잠시 후 다시 시도해주세요.`,
      ErrorCode.AI_GENERATION_FAILED,
      500
    );
  }
  throw new AppError("Pollinations 이미지 생성 재시도 초과", ErrorCode.AI_GENERATION_FAILED, 500);
}

export class PollinationsProvider implements ImageProvider {
  readonly name = "pollinations";

  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const count = options?.count ?? 1;
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;

    // 프롬프트를 영어로 짧게 제한 (URL 길이 및 인식률)
    const safePrompt = prompt.replace(/[^\x00-\x7F]/g, "").trim().substring(0, 200) || "medical health care";
    const encodedPrompt = encodeURIComponent(safePrompt);
    const urls: string[] = [];

    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;
      const localPath = await fetchWithRetry(url);
      urls.push(localPath);
    }

    return { urls };
  }
}
