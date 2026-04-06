import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics.service";
import { logger } from "@/lib/logger";

// 성과 데이터 동기화 Job — 6시간마다 실행
export async function analyticsSyncJob(): Promise<void> {
  logger.info("[analytics-sync] 시작");

  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true },
  });

  let processed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      await analyticsService.syncPostAnalytics(account);
      await analyticsService.syncAccountSnapshot(account);
      processed++;
    } catch (e) {
      logger.error(`[analytics-sync] 계정 처리 실패 (${account.platform}:${account.id}):`, e);
      failed++;
    }
  }

  if (failed > 0) {
    logger.warn(`[analytics-sync] 완료 — 처리: ${processed}, 실패: ${failed}`);
  } else {
    logger.info(`[analytics-sync] 완료 — 처리: ${processed}, 실패: ${failed}`);
  }
}
