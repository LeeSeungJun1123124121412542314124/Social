// src/ai/index.ts
import type { LLMProvider } from "./ai.provider";
import type { ImageProvider } from "./image/image.provider";
import { getActiveAIConfig, aiConfig } from "@/config/ai.config";
import { getDecryptedKey } from "@/services/settings.service";
import { AppError, ErrorCode } from "@/lib/error";
import { TextGenerator } from "./generators/text.generator";
import { CarouselGenerator } from "./generators/carousel.generator";
import { BlogGenerator } from "./generators/blog.generator";
import { BulkGenerator } from "./generators/bulk.generator";
import { RepurposeGenerator } from "./generators/repurpose.generator";

// LLM provider 팩토리 (DB 설정 우선, env 폴백)
export async function getLLMProvider(): Promise<LLMProvider> {
  const config = await getActiveAIConfig();
  const keyType = config.llmProvider === "anthropic" ? "anthropic" : "openai";
  const apiKey = await getDecryptedKey(keyType);

  if (!apiKey) {
    throw new AppError(
      `AI API 키가 설정되지 않았습니다. /settings 페이지에서 ${config.llmProvider === "anthropic" ? "Anthropic" : "OpenAI"} API 키를 먼저 설정해주세요.`,
      ErrorCode.AI_KEY_NOT_CONFIGURED,
      400
    );
  }

  switch (config.llmProvider) {
    case "openai": {
      const { OpenAIProvider } = await import("./providers/openai.provider");
      return new OpenAIProvider(apiKey);
    }
    case "anthropic": {
      const { AnthropicProvider } = await import("./providers/anthropic.provider");
      return new AnthropicProvider(apiKey);
    }
    default:
      throw new AppError(
        `지원하지 않는 LLM provider: ${config.llmProvider}`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
  }
}

// Image provider 팩토리 (DB 설정 우선, env 폴백, 직접 지정 가능)
export async function getImageProvider(overrideProvider?: "pollinations" | "dalle" | "flux"): Promise<ImageProvider> {
  const config = await getActiveAIConfig();
  const imageProvider = overrideProvider ?? config.imageProvider;

  // Pollinations는 API 키 불필요 — 바로 반환
  if (imageProvider === "pollinations") {
    const { PollinationsProvider } = await import("./image/pollinations.provider");
    return new PollinationsProvider();
  }

  const keyType = imageProvider === "dalle" ? "openai" : "fal";
  const apiKey = await getDecryptedKey(keyType);

  if (!apiKey) {
    const keyName = imageProvider === "dalle" ? "OpenAI" : "FAL";
    throw new AppError(
      `이미지 생성 API 키가 설정되지 않았습니다. /settings 페이지에서 ${keyName} API 키를 먼저 설정해주세요.`,
      ErrorCode.AI_KEY_NOT_CONFIGURED,
      400
    );
  }

  switch (imageProvider) {
    case "dalle": {
      const { DalleProvider } = await import("./image/dalle.provider");
      return new DalleProvider(apiKey);
    }
    case "flux": {
      const { FluxProvider } = await import("./image/flux.provider");
      return new FluxProvider(apiKey);
    }
    default:
      throw new AppError(
        `지원하지 않는 이미지 provider: ${imageProvider}`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
  }
}

// 편의 함수
export async function getTextGenerator(): Promise<TextGenerator> {
  return new TextGenerator(await getLLMProvider());
}

export async function getCarouselGenerator(): Promise<CarouselGenerator> {
  return new CarouselGenerator(await getLLMProvider(), await getImageProvider());
}

export async function getBlogGenerator(): Promise<BlogGenerator> {
  return new BlogGenerator(await getLLMProvider());
}

export async function getBulkGenerator(): Promise<BulkGenerator> {
  return new BulkGenerator(await getLLMProvider());
}

export async function getRepurposeGenerator(): Promise<RepurposeGenerator> {
  return new RepurposeGenerator(await getLLMProvider());
}

// 하위 호환: ai.config 기반 동기 버전 (스케줄러 등 비UI 코드용)
export { aiConfig };
