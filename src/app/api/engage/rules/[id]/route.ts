import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// 자동응답 규칙 수정 (허용 필드만 화이트리스트 방식으로 처리)
export const PATCH = apiHandler(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await req.json() as {
    platform?: string;
    triggerType?: string;
    keywords?: string[] | string | null;
    useAI?: boolean;
    templateReply?: string | null;
    salesKeywords?: string[] | string | null;
    notifyOnSales?: boolean;
    autoSend?: boolean;
    isActive?: boolean;
  };
  // 허용 필드만 명시적으로 추출하여 id, createdAt 등 내부 필드 변경 방지
  const data: Record<string, unknown> = {};
  if (body.platform !== undefined) data.platform = body.platform;
  if (body.triggerType !== undefined) data.triggerType = body.triggerType;
  if (body.keywords !== undefined) data.keywords = Array.isArray(body.keywords) ? JSON.stringify(body.keywords) : body.keywords;
  if (body.useAI !== undefined) data.useAI = body.useAI;
  if (body.templateReply !== undefined) data.templateReply = body.templateReply;
  if (body.salesKeywords !== undefined) data.salesKeywords = Array.isArray(body.salesKeywords) ? JSON.stringify(body.salesKeywords) : body.salesKeywords;
  if (body.notifyOnSales !== undefined) data.notifyOnSales = body.notifyOnSales;
  if (body.autoSend !== undefined) data.autoSend = body.autoSend;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  const rule = await prisma.autoReplyRule.update({ where: { id }, data });
  return successResponse(rule);
});

// 자동응답 규칙 삭제
export const DELETE = apiHandler(async (_req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  await prisma.autoReplyRule.delete({ where: { id } });
  return successResponse({ ok: true });
});
