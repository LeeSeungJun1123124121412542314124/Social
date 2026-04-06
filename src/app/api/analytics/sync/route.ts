import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics.service";

// 수동 동기화 — 활성 계정 전체의 게시물 성과 및 계정 스냅샷을 갱신한다
export const POST = apiHandler(async () => {
  const accounts = await prisma.socialAccount.findMany({ where: { isActive: true } });
  const results = await Promise.allSettled(
    accounts.flatMap((account) => [
      analyticsService.syncPostAnalytics(account),
      analyticsService.syncAccountSnapshot(account),
    ])
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return successResponse({ synced: accounts.length, failed });
});
