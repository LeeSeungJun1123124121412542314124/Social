// src/ai/generators/carousel.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { ImageProvider } from "../image/image.provider";
import type { GenerateCarouselInput, GeneratedCarousel, CarouselSlide } from "@/types/content.types";
import { AppError, ErrorCode } from "@/lib/error";

export class CarouselGenerator {
  constructor(
    private llm: LLMProvider,
    private imageProvider: ImageProvider
  ) {}

  /** 슬라이드 텍스트만 생성 (이미지 없음) */
  async generateSlideTexts(input: GenerateCarouselInput): Promise<GeneratedCarousel> {
    const count = input.slideCount ?? 5;

    const prompt = `병원 SNS 카드뉴스(슬라이드 ${count}장)를 작성해주세요.
주제: ${input.topic}
${input.additionalContext ? `추가 정보: ${input.additionalContext}` : ""}

각 슬라이드의 텍스트를 아래 JSON 형식으로 출력하세요. 다른 설명 없이 JSON만 출력하세요.
{
  "caption": "전체 캡션 (해시태그 포함)",
  "slides": [
    { "order": 1, "text": "슬라이드 1 텍스트" },
    ...
  ]
}`;

    const raw = await this.llm.generateText(prompt, { temperature: 0.7 });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new AppError("AI 응답에서 JSON을 찾지 못했습니다. 다시 시도해주세요.", ErrorCode.AI_GENERATION_FAILED, 500);

    let parsed: { caption: string; slides: Array<{ order: number; text: string }> };
    try {
      parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch {
      throw new AppError("AI 응답 JSON 파싱 실패. 다시 시도해주세요.", ErrorCode.AI_GENERATION_FAILED, 500);
    }

    if (!Array.isArray(parsed.slides) || !parsed.caption) {
      throw new AppError("AI 응답 구조 오류 (slides 또는 caption 없음). 다시 시도해주세요.", ErrorCode.AI_GENERATION_FAILED, 500);
    }

    return {
      slides: parsed.slides.map((s) => ({ order: s.order, text: s.text })),
      caption: parsed.caption,
    };
  }

  /** 슬라이드 텍스트 + 이미지 생성 */
  async generateWithImages(
    input: GenerateCarouselInput
  ): Promise<GeneratedCarousel> {
    const textResult = await this.generateSlideTexts(input);

    // 슬라이드별 이미지 순차 생성 (rate limit 방지)
    const style = input.style ?? "깔끔한 미니멀 디자인, 병원 브랜딩, 한국어 텍스트 제외";
    const slides: CarouselSlide[] = [];
    for (const slide of textResult.slides) {
      const result = await this.imageProvider.generateImage(
        `${input.topic} - ${slide.text?.substring(0, 50) ?? ""}. ${style}`,
        { width: 1080, height: 1080, count: 1 }
      );
      slides.push({ ...slide, imageUrl: result.urls[0] });
      // Pollinations rate limit 방지 (슬라이드 사이 1초 대기)
      if (this.imageProvider.name === "pollinations") {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return { slides, caption: textResult.caption };
  }
}
