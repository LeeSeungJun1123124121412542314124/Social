import type { TTSOptions, TTSResult } from "@/types/ai.types";

// TTS provider 공통 인터페이스
export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}
