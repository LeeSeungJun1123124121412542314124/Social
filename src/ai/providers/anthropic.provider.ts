import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "../ai.provider";
import type { LLMOptions } from "@/types/ai.types";
import { AppError, ErrorCode } from "@/lib/error";
import { aiConfig } from "@/config/ai.config";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AppError(
        "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    try {
      const params = {
        model: options?.model ?? aiConfig.anthropicModel,
        max_tokens: options?.maxTokens ?? aiConfig.defaultMaxTokens,
        messages: [{ role: "user" as const, content: prompt }],
        temperature: options?.temperature ?? aiConfig.defaultTemperature,
        ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      };
      const response = await this.client.messages.create(params) as Anthropic.Message;

      const content = response.content[0];
      return content?.type === "text" ? content.text : "";
    } catch (err) {
      throw new AppError(
        `Anthropic 텍스트 생성 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        ErrorCode.AI_GENERATION_FAILED
      );
    }
  }

  async *streamText(
    prompt: string,
    options?: LLMOptions
  ): AsyncIterable<string> {
    try {
      const streamParams = {
        model: options?.model ?? aiConfig.anthropicModel,
        max_tokens: options?.maxTokens ?? aiConfig.defaultMaxTokens,
        messages: [{ role: "user" as const, content: prompt }],
        ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      };
      const stream = await this.client.messages.stream(streamParams);

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          yield chunk.delta.text;
        }
      }
    } catch (err) {
      throw new AppError(
        `Anthropic 스트리밍 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        ErrorCode.AI_GENERATION_FAILED
      );
    }
  }
}
