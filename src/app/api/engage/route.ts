import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

// 인게이지 목록 조회
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const result = await engageService.listItems({
    platform: searchParams.get("platform") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    triggerType: searchParams.get("triggerType") ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
  });
  return successResponse(result);
});
