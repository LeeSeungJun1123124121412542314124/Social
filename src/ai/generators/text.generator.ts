import type { LLMProvider } from "../ai.provider";
import type {
  GenerateTextInput,
  GeneratedText,
} from "@/types/content.types";
import type { PlatformType } from "@/types/platform.types";
import { PLATFORMS } from "@/lib/constants";

// 플랫폼별 작성 가이드
const PLATFORM_GUIDES: Record<PlatformType, string> = {
  instagram: "해시태그 5~10개 포함, 이모지 적절히 활용, 2200자 이내",
  threads: "간결하고 대화체, 500자 이내, 해시태그 최소화",
  x: "280자 이내, 임팩트 있는 문장 1~2개",
  youtube: "유튜브 커뮤니티 포스트 스타일, 시청자 참여 유도",
  tiktok: "숏폼 느낌의 캐주얼한 톤, 트렌디한 표현 사용",
};

const LENGTH_GUIDES = {
  short: "짧고 핵심만 전달 (1~2문장)",
  medium: "중간 길이 (3~5문장)",
  long: "상세하게 설명 (6문장 이상)",
};

export class TextGenerator {
  constructor(private llm: LLMProvider) {}

  async generatePost(input: GenerateTextInput): Promise<GeneratedText> {
    const platformConfig = PLATFORMS[input.platform];
    const platformGuide = PLATFORM_GUIDES[input.platform];
    const lengthGuide = LENGTH_GUIDES[input.length ?? "medium"];

    const systemPrompt = `당신은 병원 SNS 마케팅 전문가입니다.
병원과 의료 서비스를 홍보하는 SNS 게시물을 작성합니다.
플랫폼: ${platformConfig.name}
작성 규칙: ${platformGuide}
길이: ${lengthGuide}
톤: ${input.tone ?? "전문적이면서 친근한"}
반드시 한국어로 작성하세요.`;

    const prompt = `다음 주제로 ${platformConfig.name} 게시물을 작성해주세요.
주제: ${input.topic}
${input.additionalContext ? `추가 정보: ${input.additionalContext}` : ""}

게시물 본문만 출력하세요. 설명이나 주석은 포함하지 마세요.`;

    const text = await this.llm.generateText(prompt, {
      systemPrompt,
      temperature: 0.7,
    });

    // 해시태그 추출 (텍스트에서 #으로 시작하는 단어)
    const hashtags = text.match(/#[가-힣a-zA-Z0-9_]+/g)?.map((h) =>
      h.replace("#", "")
    );

    return {
      text,
      platform: input.platform,
      characterCount: text.length,
      hashtags,
    };
  }

  // 여러 플랫폼에 맞게 동시 생성
  async generateMultiPlatform(
    topic: string,
    platforms: PlatformType[]
  ): Promise<GeneratedText[]> {
    return Promise.all(
      platforms.map((platform) =>
        this.generatePost({ topic, platform })
      )
    );
  }
}
