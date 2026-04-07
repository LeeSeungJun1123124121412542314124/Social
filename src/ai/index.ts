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
      const { OpenAIProvider } = require("./providers/openai.provider") as { OpenAIProvider: new (key: string) => LLMProvider };
      return new OpenAIProvider(apiKey);
    }
    case "anthropic": {
      const { AnthropicProvider } = require("./providers/anthropic.provider") as { AnthropicProvider: new (key: string) => LLMProvider };
      return new AnthropicProvider(apiKey);
    }
    default:
      throw new AppError(
        `지원하지 않는 LLM provider: ${config.llmProvider}`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
  }
}

// Image provider 팩토리 (DB 설정 우선, env 폴백)
export async function getImageProvider(): Promise<ImageProvider> {
  const config = await getActiveAIConfig();

  // Pollinations는 API 키 불필요 — 바로 반환
  if (config.imageProvider === "pollinations") {
    const { PollinationsProvider } = require("./image/pollinations.provider") as { PollinationsProvider: new () => ImageProvider };
    return new PollinationsProvider();
  }

  const keyType = config.imageProvider === "dalle" ? "openai" : "fal";
  const apiKey = await getDecryptedKey(keyType);

  if (!apiKey) {
    const keyName = config.imageProvider === "dalle" ? "OpenAI" : "FAL";
    throw new AppError(
      `이미지 생성 API 키가 설정되지 않았습니다. /settings 페이지에서 ${keyName} API 키를 먼저 설정해주세요.`,
      ErrorCode.AI_KEY_NOT_CONFIGURED,
      400
    );
  }

  switch (config.imageProvider) {
    case "dalle": {
      const { DalleProvider } = require("./image/dalle.provider") as { DalleProvider: new (key: string) => ImageProvider };
      return new DalleProvider(apiKey);
    }
    case "flux": {
      const { FluxProvider } = require("./image/flux.provider") as { FluxProvider: new (key: string) => ImageProvider };
      return new FluxProvider(apiKey);
    }
    default:
      throw new AppError(
        `지원하지 않는 이미지 provider: ${config.imageProvider}`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
  }
}

// 편의 함수 - async 버전
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

// 텍스트 전용 생성기 (이미지 provider 불필요) - LLM만 확인
export async function getLLMOnlyCarouselGenerator(): Promise<CarouselGenerator> {
  const llm = await getLLMProvider();
  // 이미지 없이 텍스트만 생성하는 경우 - 더미 image provider 불필요하므로
  // imageProvider 키가 없어도 텍스트 생성 가능하도록 처리
  const config = await getActiveAIConfig();
  const keyType = config.imageProvider === "dalle" ? "openai" : "fal";
  const imageKey = await getDecryptedKey(keyType);

  let imageProvider: ImageProvider;
  if (imageKey) {
    imageProvider = await getImageProvider();
  } else {
    // 이미지 키 없을 때 더미 provider (텍스트만 생성 시 사용)
    imageProvider = {
      name: "none",
      async generateImage() { return { urls: [] }; },
    };
  }

  return new CarouselGenerator(llm, imageProvider);
}

// 하위 호환: ai.config 기반 동기 버전 (스케줄러 등 비UI 코드용)
export { aiConfig };
