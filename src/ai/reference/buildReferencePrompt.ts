// src/ai/reference/buildReferencePrompt.ts
// 네이버 참고자료 + 브랜드 톤 프롬프트 블록 빌더

import type { WebReference } from "@/services/webReference.service";

/**
 * 브랜드 톤 지침 블록 — LLM이 최우선으로 따르도록 명시
 */
export function buildBrandToneBlock(brandTonePrompt: string): string {
  return `[브랜드 톤 지침 — 최우선]
아래 지침의 문체·어조·태도를 글 전체에서 일관되게 유지하세요.
${brandTonePrompt.trim()}
[브랜드 톤 지침 끝]`;
}

/**
 * 네이버 참고자료 블록 — 소재/키워드/구성 참고용 (문체는 브랜드 톤 우선)
 */
export function buildReferenceBlock(ref: WebReference): string {
  return `[최근 콘텐츠 트렌드 참고자료]
아래 글은 주제에 대해 독자가 관심을 갖는 소재·키워드·구성·질문 방식을 파악하기 위한 참고자료입니다.
문체·어조는 이 글을 따르지 마세요. 위 [브랜드 톤 지침]을 최우선으로 따르세요.

제목: ${ref.title}
출처: ${ref.source}
본문 발췌 (최대 2,000자):
${ref.contentExcerpt}
[참고자료 끝]`;
}
