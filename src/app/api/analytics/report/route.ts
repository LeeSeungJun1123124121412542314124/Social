import { apiHandler, successResponse } from "@/lib/api-response";
import { analyticsService } from "@/services/analytics.service";

// AI 주간 리포트 생성
export const POST = apiHandler(async () => {
  const report = await analyticsService.generateWeeklyReport();
  return successResponse({ report });
});
