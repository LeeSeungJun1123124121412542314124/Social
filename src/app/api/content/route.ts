import { apiHandler, successResponse } from "@/lib/api-response";
import { contentService } from "@/services/content.service";

// 콘텐츠 목록 조회
// ?status=draft          → 기존 동작 유지
// ?type=text&limit=5     → 타입별 최근 N개 조회 (히스토리 패널용)
// ?type=blog&since=7d    → 타입 + 날짜 필터 (검색 모달용, 7d | 30d)
export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limitStr = url.searchParams.get("limit");
  const limitParsed = limitStr !== null ? parseInt(limitStr, 10) : undefined;
  // NaN(비숫자 입력) 방어 — NaN이면 기본값 5가 적용되도록 undefined 처리
  const limit = limitParsed !== undefined && Number.isFinite(limitParsed) ? limitParsed : undefined;

  // since=7d | 30d → sinceDays 숫자로 변환 (다른 형식은 무시)
  const sinceRaw = url.searchParams.get("since");
  let sinceDays: number | undefined;
  if (sinceRaw) {
    const m = /^(\d+)d$/.exec(sinceRaw);
    if (m) sinceDays = parseInt(m[1], 10);
  }

  if (type !== undefined) {
    const posts = await contentService.getRecentByType(type, limit ?? 5, sinceDays);
    return successResponse(posts);
  }

  const posts = await contentService.getAll(status);
  return successResponse(posts);
});

// 콘텐츠 생성 (임시저장)
export const POST = apiHandler(async (req) => {
  const body = await req.json() as {
    type: string;
    title?: string;
    contentText?: string;
    contentData?: string;
    mediaUrls?: string[];
    accountIds?: string[];
  };
  const post = await contentService.create(body);
  return successResponse(post, 201);
});
