// src/ai/generators/bulk.generator.ts
import type { LLMProvider } from "../ai.provider";
import type { BulkPlan, BulkInput } from "@/types/content.types";

export class BulkGenerator {
  constructor(private llm: LLMProvider) {}

  async generateIdeas(input: BulkInput): Promise<BulkPlan> {
    const platformStr = input.platforms.join(", ");
    const prompt = `병원 SNS 콘텐츠 ${input.count}개 기획안을 만들어주세요.
테마: ${input.theme}
기간: ${input.period ?? `${input.count}개`}
플랫폼: ${platformStr}

각 아이디어를 다음 JSON 형식으로 출력하세요. JSON만 출력:
{
  "theme": "${input.theme}",
  "ideas": [
    {
      "title": "게시물 제목",
      "topic": "구체적인 주제/내용 방향(반드시 비어있지 않은 한 문장 이상. title이 충분히 구체적이면 title을 확장한 형태로)",
      "platform": "${input.platforms[0]}",
      "contentType": "text",
      "suggestedTone": "전문적이면서 친근한",
      "hashtags": ["해시태그1", "해시태그2"]
    }
  ]
}

contentType은 text, carousel, blog 중 하나. platform은 ${platformStr} 중 하나.
⚠️ 중요: topic은 절대 빈 문자열이면 안 됩니다. contentType이 text든 carousel이든 동일하게 구체적인 내용 방향을 담으세요.`;

    const raw = await this.llm.generateText(prompt, {
      temperature: 0.8,
      maxTokens: 4096,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("대량기획 JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]) as BulkPlan;
    if (!Array.isArray(parsed.ideas)) {
      throw new Error("대량기획 JSON 구조 오류: ideas 없음");
    }

    return parsed;
  }
}
