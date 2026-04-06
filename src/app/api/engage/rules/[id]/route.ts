import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// 자동응답 규칙 수정
export const PATCH = apiHandler(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await req.json() as Record<string, unknown>;
  // keywords/salesKeywords 배열은 JSON 문자열로 직렬화
  if (Array.isArray(body.keywords)) body.keywords = JSON.stringify(body.keywords);
  if (Array.isArray(body.salesKeywords)) body.salesKeywords = JSON.stringify(body.salesKeywords);
  const rule = await prisma.autoReplyRule.update({ where: { id }, data: body });
  return successResponse(rule);
});

// 자동응답 규칙 삭제
export const DELETE = apiHandler(async (_req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  await prisma.autoReplyRule.delete({ where: { id } });
  return successResponse({ ok: true });
});
