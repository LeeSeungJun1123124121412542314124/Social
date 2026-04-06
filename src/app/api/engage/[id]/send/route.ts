import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";
import { AppError, ErrorCode } from "@/lib/error";

// 인게이지 항목 응답 발송
export const POST = apiHandler(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await req.json() as { text?: string };
  if (!body.text?.trim()) throw new AppError("응답 텍스트가 없습니다.", ErrorCode.VALIDATION_ERROR, 400);
  await engageService.sendReply(id, body.text);
  return successResponse({ ok: true });
});
