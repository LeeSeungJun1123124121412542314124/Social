import { prisma } from "@/lib/prisma";
import { engageService } from "@/services/engage.service";
import { logger } from "@/lib/logger";

// 댓글/DM 폴링 Job — 15분마다 실행 (X 제외)
export async function engagePollJob(): Promise<void> {
  logger.info("[engage-poll] 시작");

  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true },
  });

  let processed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      await engageService.pollAndProcess(account);
      processed++;
    } catch (e) {
      logger.error(`[engage-poll] 계정 처리 실패 (${account.platform}:${account.id}):`, e);
      failed++;
    }
  }

  logger.info(`[engage-poll] 완료 — 처리: ${processed}, 실패: ${failed}`);
}
