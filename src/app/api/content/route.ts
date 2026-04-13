import { apiHandler, successResponse } from "@/lib/api-response";
import { contentService } from "@/services/content.service";

// 콘텐츠 목록 조회
// ?status=draft  → 기존 동작 유지
// ?type=text&limit=5 → 타입별 최근 N개 조회 (히스토리 패널용)
export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  if (type !== undefined) {
    const posts = await contentService.getRecentByType(type, limit ?? 5);
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
