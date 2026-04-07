import { apiHandler, successResponse } from "@/lib/api-response";
import { contentService } from "@/services/content.service";

// 콘텐츠 단건 조회
export const GET = apiHandler(async (_req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const post = await contentService.getById(id);
  return successResponse(post);
});

// 콘텐츠 수정
export const PATCH = apiHandler(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await req.json() as Parameters<typeof contentService.update>[1];
  const post = await contentService.update(id, body);
  return successResponse(post);
});

// 콘텐츠 삭제
export const DELETE = apiHandler(async (_req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  await contentService.delete(id);
  return successResponse({ message: "삭제되었습니다." });
});
