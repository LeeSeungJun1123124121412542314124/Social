import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

export interface AISettingsDTO {
  llmProvider: "openai" | "anthropic";
  imageProvider: "flux" | "dalle";
  openaiKeyConfigured: boolean;
  anthropicKeyConfigured: boolean;
  falKeyConfigured: boolean;
}

export interface UpdateAISettingsInput {
  llmProvider?: "openai" | "anthropic";
  imageProvider?: "flux" | "dalle" | "pollinations";
  openaiApiKey?: string;      // 빈 문자열 = 삭제, undefined = 변경없음
  anthropicApiKey?: string;
  falApiKey?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export const settingsService = {
  async getAISettings(): Promise<AISettingsDTO> {
    const settings = await prisma.appSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });

    // 각 키가 DB 또는 env에 설정되어 있는지 확인
    const openaiKey = await getDecryptedKey("openai");
    const anthropicKey = await getDecryptedKey("anthropic");
    const falKey = await getDecryptedKey("fal");

    return {
      llmProvider: settings.llmProvider as "openai" | "anthropic",
      imageProvider: settings.imageProvider as "flux" | "dalle",
      openaiKeyConfigured: !!openaiKey,
      anthropicKeyConfigured: !!anthropicKey,
      falKeyConfigured: !!falKey,
    };
  },

  async updateAISettings(input: UpdateAISettingsInput): Promise<AISettingsDTO> {
    const data: Record<string, unknown> = {};

    if (input.llmProvider !== undefined) data.llmProvider = input.llmProvider;
    if (input.imageProvider !== undefined) data.imageProvider = input.imageProvider;

    // 키 처리: 빈 문자열이면 null(삭제), 값이 있으면 암호화 저장
    if (input.openaiApiKey !== undefined) {
      data.encryptedOpenaiKey = input.openaiApiKey.trim()
        ? encrypt(input.openaiApiKey.trim())
        : null;
    }
    if (input.anthropicApiKey !== undefined) {
      data.encryptedAnthropicKey = input.anthropicApiKey.trim()
        ? encrypt(input.anthropicApiKey.trim())
        : null;
    }
    if (input.falApiKey !== undefined) {
      data.encryptedFalKey = input.falApiKey.trim()
        ? encrypt(input.falApiKey.trim())
        : null;
    }

    await prisma.appSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    logger.info("AI 설정 업데이트 완료");
    return this.getAISettings();
  },

  async testConnection(provider: "openai" | "anthropic" | "flux" | "dalle"): Promise<TestConnectionResult> {
    const start = Date.now();

    try {
      if (provider === "openai" || provider === "dalle") {
        const apiKey = await getDecryptedKey("openai");
        if (!apiKey) {
          return { success: false, message: "OpenAI API 키가 설정되지 않았습니다." };
        }
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey });
        await client.models.list();
        return { success: true, message: "OpenAI 연결 성공", latencyMs: Date.now() - start };
      }

      if (provider === "anthropic") {
        const apiKey = await getDecryptedKey("anthropic");
        if (!apiKey) {
          return { success: false, message: "Anthropic API 키가 설정되지 않았습니다." };
        }
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        // 최소 토큰으로 연결 확인
        await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        });
        return { success: true, message: "Anthropic 연결 성공", latencyMs: Date.now() - start };
      }

      if (provider === "flux") {
        const apiKey = await getDecryptedKey("fal");
        if (!apiKey) {
          return { success: false, message: "FAL API 키가 설정되지 않았습니다." };
        }
        // fal.ai 키 형식 확인 (key:secret 형태)
        if (!apiKey.includes(":")) {
          return { success: false, message: "FAL API 키 형식이 올바르지 않습니다. (형식: key:secret)" };
        }
        return { success: true, message: "Flux(fal.ai) 키 형식 확인 완료", latencyMs: Date.now() - start };
      }

      return { success: false, message: `알 수 없는 provider: ${provider}` };
    } catch (err) {
      logger.error(`${provider} 연결 테스트 실패:`, err);
      return {
        success: false,
        message: err instanceof Error ? err.message : "연결 실패",
        latencyMs: Date.now() - start,
      };
    }
  },
};

// 내부 헬퍼: DB 우선, env 폴백
export async function getDecryptedKey(keyType: "openai" | "anthropic" | "fal"): Promise<string | null> {
  try {
    const settings = await prisma.appSetting.findUnique({
      where: { id: "singleton" },
    });

    const encryptedField = {
      openai: settings?.encryptedOpenaiKey,
      anthropic: settings?.encryptedAnthropicKey,
      fal: settings?.encryptedFalKey,
    }[keyType];

    if (encryptedField) {
      return decrypt(encryptedField);
    }
  } catch {
    // DB 오류 시 env 폴백
  }

  // env 폴백
  const envValue = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    fal: process.env.FAL_KEY,
  }[keyType];

  return envValue && envValue.trim() !== "" && envValue !== '""' ? envValue : null;
}
