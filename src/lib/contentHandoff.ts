// src/lib/contentHandoff.ts
// 대량기획 → 개별 콘텐츠 페이지 간 1회용 핸드오프 유틸리티.
// URL에 고유 키, sessionStorage에 실제 페이로드를 저장해 Consume-and-Replace 패턴 구현.
import type { PlatformType } from "@/types/platform.types";

export type ContentHandoff = {
  topic: string;
  platform?: PlatformType;
  tone?: string;        // LLM suggestedTone (자유 서술), 수신 측에서 매핑 필요
  title?: string;       // 원본 아이디어 제목, 참고용
  hashtags?: string[];  // 향후 활용을 위한 메타데이터
};

const PREFIX = "content-handoff:";

/**
 * 페이로드를 sessionStorage에 저장하고 고유 키를 반환한다.
 * 반환된 키를 URL 쿼리 파라미터 `handoff`로 전달한다.
 * sessionStorage 쓰기 실패(privacy 모드 등) 시 빈 문자열 반환.
 */
export function createHandoff(payload: ContentHandoff): string {
  if (typeof window === "undefined") return "";
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(payload));
  } catch {
    return "";
  }
  return key;
}

/**
 * 키에 해당하는 페이로드를 1회 소비한다.
 * 읽는 즉시 sessionStorage에서 삭제하므로 새로고침·뒤로가기로 재적용되지 않는다.
 */
export function consumeHandoff(key: string | null | undefined): ContentHandoff | null {
  if (!key || typeof window === "undefined") return null;
  const storageKey = PREFIX + key;
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return null;
  window.sessionStorage.removeItem(storageKey);
  try {
    return JSON.parse(raw) as ContentHandoff;
  } catch {
    return null;
  }
}
