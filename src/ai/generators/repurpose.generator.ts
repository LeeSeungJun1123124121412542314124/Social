// src/ai/generators/repurpose.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { RepurposeInput, RepurposeResult, ContentType } from "@/types/content.types";

const FORMAT_PROMPTS: Record<ContentType, string> = {
  text: "SNS 텍스트 게시물 (해시태그 포함, 해당 플랫폼 최적화)",
  carousel: "카드뉴스 슬라이드 구성 (슬라이드별 핵심 내용 요약)",
  blog: "블로그 아티클 (제목, 본문, 태그 포함)",
  short_form: "숏폼 영상 스크립트 (훅 + 본문 + CTA)",
  thread: "쓰레드/연속 게시물 (번호 붙인 연속 트윗/쓰레드)",
};

export class RepurposeGenerator {
  constructor(private llm: LLMProvider) {}

  async repurpose(input: RepurposeInput): Promise<RepurposeResult[]> {
    const results: RepurposeResult[] = [];

    for (const format of input.targetFormats) {
      const platforms = input.targetPlatforms ?? [];
      const platformStr = platforms.length > 0 ? `대상 플랫폼: ${platforms.join(", ")}` : "";

      const prompt = `다음 원본 콘텐츠를 ${FORMAT_PROMPTS[format] ?? format} 형식으로 변환해주세요.
원본 유형: ${input.sourceType}
${platformStr}

원본 내용:
${input.sourceContent}

변환된 콘텐츠만 출력하세요. 형식: JSON
{
  "format": "${format}",
  "platform": ${platforms[0] ? `"${platforms[0]}"` : "null"},
  "title": "제목 (있는 경우)",
  "text": "변환된 텍스트 본문",
  "hashtags": ["해시태그"]
}`;

      const raw = await this.llm.generateText(prompt, { temperature: 0.7 });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      try {
        const parsed = JSON.parse(jsonMatch[0]) as RepurposeResult;
        if (!parsed.text) continue; // text 없으면 건너뜀
        results.push(parsed);
      } catch {
        // 파싱 실패한 형식은 건너뜀
      }
    }

    return results;
  }
}
