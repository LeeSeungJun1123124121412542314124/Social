import OpenAI from "openai";
import type { LLMProvider } from "../ai.provider";
import type { LLMOptions } from "@/types/ai.types";
import { AppError, ErrorCode } from "@/lib/error";
import { aiConfig } from "@/config/ai.config";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new AppError(
        "OPENAI_API_KEY가 설정되지 않았습니다.",
        ErrorCode.AI_PROVIDER_UNAVAILABLE
      );
    }
    this.client = new OpenAI({ apiKey: key });
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (options?.systemPrompt) {
        messages.push({ role: "system", content: options.systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await this.client.chat.completions.create({
        model: options?.model ?? aiConfig.openaiModel,
        messages,
        temperature: options?.temperature ?? aiConfig.defaultTemperature,
        max_tokens: options?.maxTokens ?? aiConfig.defaultMaxTokens,
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (err) {
      throw new AppError(
        `OpenAI 텍스트 생성 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        ErrorCode.AI_GENERATION_FAILED
      );
    }
  }

  async *streamText(
    prompt: string,
    options?: LLMOptions
  ): AsyncIterable<string> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (options?.systemPrompt) {
        messages.push({ role: "system", content: options.systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const stream = await this.client.chat.completions.create({
        model: options?.model ?? aiConfig.openaiModel,
        messages,
        temperature: options?.temperature ?? aiConfig.defaultTemperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (err) {
      throw new AppError(
        `OpenAI 스트리밍 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        ErrorCode.AI_GENERATION_FAILED
      );
    }
  }
}
