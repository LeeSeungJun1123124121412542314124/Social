// src/ai/index.ts
import type { LLMProvider } from "./ai.provider";
import type { ImageProvider } from "./image/image.provider";
import { aiConfig } from "@/config/ai.config";
import { AppError, ErrorCode } from "@/lib/error";
import { TextGenerator } from "./generators/text.generator";
import { CarouselGenerator } from "./generators/carousel.generator";
// Blog/Bulk/Repurpose Generator는 Group 4에서 구현 예정 - 아래 주석은 그때 해제
// import { BlogGenerator } from "./generators/blog.generator";
// import { BulkGenerator } from "./generators/bulk.generator";
// import { RepurposeGenerator } from "./generators/repurpose.generator";

// LLM provider 팩토리
export function getLLMProvider(): LLMProvider {
  switch (aiConfig.llmProvider) {
    case "openai": {
      const { OpenAIProvider } = require("./providers/openai.provider") as { OpenAIProvider: new () => LLMProvider };
      return new OpenAIProvider();
    }
    case "anthropic": {
      const { AnthropicProvider } = require("./providers/anthropic.provider") as { AnthropicProvider: new () => LLMProvider };
      return new AnthropicProvider();
    }
    default:
      throw new AppError(
        `지원하지 않는 LLM provider: ${aiConfig.llmProvider}`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
  }
}

// Image provider 팩토리
export function getImageProvider(): ImageProvider {
  switch (aiConfig.imageProvider) {
    case "dalle": {
      const { DalleProvider } = require("./image/dalle.provider") as { DalleProvider: new () => ImageProvider };
      return new DalleProvider();
    }
    case "flux": {
      const { FluxProvider } = require("./image/flux.provider") as { FluxProvider: new () => ImageProvider };
      return new FluxProvider();
    }
    default:
      throw new AppError(
        `지원하지 않는 이미지 provider: ${aiConfig.imageProvider}`,
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
  }
}

// 편의 함수 - 자주 쓰는 생성기를 바로 가져옴
export function getTextGenerator(): TextGenerator {
  return new TextGenerator(getLLMProvider());
}

export function getCarouselGenerator(): CarouselGenerator {
  return new CarouselGenerator(getLLMProvider(), getImageProvider());
}

// 아래 factory 함수들은 Group 4에서 generator 파일 생성 후 주석 해제 예정
// export function getBlogGenerator(): BlogGenerator {
//   return new BlogGenerator(getLLMProvider());
// }
// export function getBulkGenerator(): BulkGenerator {
//   return new BulkGenerator(getLLMProvider());
// }
// export function getRepurposeGenerator(): RepurposeGenerator {
//   return new RepurposeGenerator(getLLMProvider());
// }
