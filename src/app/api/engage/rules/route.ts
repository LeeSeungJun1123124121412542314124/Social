import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { AppError, ErrorCode } from "@/lib/error";

// 자동응답 규칙 목록 조회
export const GET = apiHandler(async () => {
  const rules = await prisma.autoReplyRule.findMany({ orderBy: { createdAt: "desc" } });
  return successResponse(rules);
});

// 자동응답 규칙 생성
export const POST = apiHandler(async (req) => {
  const body = await req.json() as {
    platform: string;
    triggerType: string;
    keywords?: string[];
    useAI?: boolean;
    templateReply?: string;
    salesKeywords?: string[];
    notifyOnSales?: boolean;
    autoSend?: boolean;
  };
  if (!body.platform || !body.triggerType) {
    throw new AppError("platform, triggerType은 필수입니다.", ErrorCode.VALIDATION_ERROR, 400);
  }
  const rule = await prisma.autoReplyRule.create({
    data: {
      platform: body.platform,
      triggerType: body.triggerType,
      keywords: body.keywords ? JSON.stringify(body.keywords) : null,
      useAI: body.useAI ?? true,
      templateReply: body.templateReply,
      salesKeywords: body.salesKeywords ? JSON.stringify(body.salesKeywords) : null,
      notifyOnSales: body.notifyOnSales ?? true,
      autoSend: body.autoSend ?? false,
    },
  });
  return successResponse(rule, 201);
});
