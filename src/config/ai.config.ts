// AI 서비스 설정
export const aiConfig = {
  // 사용할 LLM provider: openai | anthropic
  llmProvider: (process.env.LLM_PROVIDER ?? "openai") as "openai" | "anthropic",

  // 사용할 이미지 생성 provider: flux | dalle
  imageProvider: (process.env.IMAGE_PROVIDER ?? "flux") as "flux" | "dalle",

  // 기본 모델
  openaiModel: "gpt-4o",
  anthropicModel: "claude-sonnet-4-6",

  // 기본 생성 설정
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
} as const;
