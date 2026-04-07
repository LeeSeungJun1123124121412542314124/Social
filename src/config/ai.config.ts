import { prisma } from "@/lib/prisma";

// AI 서비스 정적 설정 (env 기반 폴백용)
export const aiConfig = {
  // 사용할 LLM provider: openai | anthropic
  llmProvider: (process.env.LLM_PROVIDER ?? "openai") as "openai" | "anthropic",

  // 사용할 이미지 생성 provider: flux | dalle | pollinations
  imageProvider: (process.env.IMAGE_PROVIDER ?? "pollinations") as "flux" | "dalle" | "pollinations",

  // 기본 모델
  openaiModel: "gpt-4o",
  anthropicModel: "claude-sonnet-4-6",

  // 기본 생성 설정
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
} as const;

// DB 우선, env 폴백으로 현재 활성 AI 설정을 반환
export async function getActiveAIConfig(): Promise<{
  llmProvider: "openai" | "anthropic";
  imageProvider: "flux" | "dalle" | "pollinations";
}> {
  try {
    const settings = await prisma.appSetting.findUnique({
      where: { id: "singleton" },
    });
    if (settings) {
      return {
        llmProvider: settings.llmProvider as "openai" | "anthropic",
        imageProvider: settings.imageProvider as "flux" | "dalle" | "pollinations",
      };
    }
  } catch {
    // DB 미연결 시 env 폴백
  }
  return {
    llmProvider: aiConfig.llmProvider,
    imageProvider: aiConfig.imageProvider,
  };
}
