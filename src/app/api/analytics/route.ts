import { apiHandler, successResponse } from "@/lib/api-response";
import { analyticsService } from "@/services/analytics.service";

// 대시보드 데이터 조회
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? "all";
  const days = Number(searchParams.get("days") ?? "30");
  const data = await analyticsService.getDashboard(platform, days);
  return successResponse(data);
});
