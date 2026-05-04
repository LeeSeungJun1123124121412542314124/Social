// src/ai/generators/blog.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { GenerateBlogInput, GeneratedBlog } from "@/types/content.types";
import { AppError, ErrorCode } from "@/lib/error";
import { prisma } from "@/lib/prisma";
import { fetchTopReference, type WebReference } from "@/services/webReference.service";
import { buildBrandToneBlock, buildReferenceBlock } from "@/ai/reference/buildReferencePrompt";
import { logger } from "@/lib/logger";

export class BlogGenerator {
  constructor(private llm: LLMProvider) {}

  async generateBlog(input: GenerateBlogInput): Promise<GeneratedBlog> {
    const targetLength = input.targetLength ?? 800;
    const keywordStr = input.keywords?.join(", ") ?? "";

    // (1) brandTonePrompt 필수 체크
    const settings = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
    const brandTone = settings?.brandTonePrompt?.trim();
    if (!brandTone) {
      throw new AppError(
        "브랜드 톤을 먼저 설정하세요. 설정 페이지에서 '브랜드 톤 프롬프트'를 입력해야 블로그를 생성할 수 있습니다.",
        ErrorCode.BRAND_TONE_REQUIRED,
        400
      );
    }

    // (2) 참고자료 수집 (옵션, fail-open)
    let fetchedRef: WebReference | null = null;
    let referenceFallback = false;
    if (input.useWebReference) {
      try {
        fetchedRef = await fetchTopReference(input.topic);
        if (!fetchedRef) {
          referenceFallback = true;
          logger.info("블로그 생성 — 참고자료 없음(3건 실패), 브랜드 톤만으로 생성");
        }
      } catch (err) {
        referenceFallback = true;
        logger.warn("블로그 생성 — 참고자료 수집 실패, 브랜드 톤만으로 생성:", err);
      }
    }

    // (3) 프롬프트 조립: [참고자료]? → [브랜드 톤] → [작성 요청]
    const corePrompt = `병원 블로그 아티클을 작성해주세요.
주제: ${input.topic}
목표 분량: ${targetLength}자 이상
${keywordStr ? `포함 키워드: ${keywordStr}` : ""}
${input.additionalContext ? `추가 정보: ${input.additionalContext}` : ""}

다음 JSON 형식으로만 출력하세요. 설명 없이 JSON만:
{
  "title": "블로그 제목",
  "excerpt": "150자 이내 요약",
  "body": "본문 (마크다운 형식)",
  "tags": ["태그1", "태그2"]
}`;

    const prompt = [
      fetchedRef ? buildReferenceBlock(fetchedRef) : "",
      buildBrandToneBlock(brandTone),
      corePrompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    // (4) LLM 호출
    const raw = await this.llm.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 4096,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("블로그 JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      excerpt: string;
      body: string;
      tags: string[];
    };

    if (!parsed.title || !parsed.body) {
      throw new Error("블로그 JSON 구조 오류: title 또는 body 없음");
    }

    // (5) 반환 — reference, referenceFallback 포함
    const result: GeneratedBlog = {
      title: parsed.title,
      body: parsed.body,
      excerpt: parsed.excerpt,
      tags: parsed.tags ?? [],
      wordCount: parsed.body.length,
    };
    if (fetchedRef) {
      result.reference = {
        title: fetchedRef.title,
        url: fetchedRef.url,
        source: fetchedRef.source,
        rank: fetchedRef.rank,
      };
    }
    if (referenceFallback) {
      result.referenceFallback = true;
    }
    return result;
  }
}
