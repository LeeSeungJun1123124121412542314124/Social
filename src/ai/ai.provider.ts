import type { LLMOptions } from "@/types/ai.types";

// LLM provider 공통 인터페이스
// OpenAI ↔ Anthropic 교체 가능
export interface LLMProvider {
  readonly name: string;

  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  streamText(
    prompt: string,
    options?: LLMOptions
  ): AsyncIterable<string>;
}
