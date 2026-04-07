import { apiHandler, successResponse } from "@/lib/api-response";
import { contentService } from "@/services/content.service";

// 콘텐츠 목록 조회
export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
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
