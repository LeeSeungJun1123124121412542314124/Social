import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

// 인게이지 항목 초안 수정·상태 변경
export const PATCH = apiHandler(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await req.json() as { aiDraft?: string; status?: string };
  const item = await engageService.updateItem(id, body);
  return successResponse(item);
});
