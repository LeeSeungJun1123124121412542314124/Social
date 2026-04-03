export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ImageOptions {
  width?: number;
  height?: number;
  style?: string;
  count?: number;
}

export interface ImageResult {
  urls: string[];
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSResult {
  audioUrl: string;
  duration?: number;
}
