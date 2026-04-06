// src/ai/generators/blog.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { GenerateBlogInput, GeneratedBlog } from "@/types/content.types";

export class BlogGenerator {
  constructor(private llm: LLMProvider) {}

  async generateBlog(input: GenerateBlogInput): Promise<GeneratedBlog> {
    const targetLength = input.targetLength ?? 800;
    const keywordStr = input.keywords?.join(", ") ?? "";

    const prompt = `병원 블로그 아티클을 작성해주세요.
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

    return {
      title: parsed.title,
      body: parsed.body,
      excerpt: parsed.excerpt,
      tags: parsed.tags ?? [],
      wordCount: parsed.body.length,
    };
  }
}
