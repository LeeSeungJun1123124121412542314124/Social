import cron from "node-cron";
import { publishJob } from "./jobs/publish.job";
import { tokenRefreshJob } from "./jobs/token-refresh.job";
import { analyticsSyncJob } from "./jobs/analytics-sync.job";
// import { engagePollJob } from "./jobs/engage-poll.job"; // 댓글/DM 기능 숨김 처리로 비활성화 (2026-04-14)
import { schedulerConfig } from "@/config/scheduler.config";
import { logger } from "@/lib/logger";

let isInitialized = false;

export function initScheduler(): void {
  if (isInitialized) {
    logger.debug("스케줄러 이미 초기화됨, 건너뜀");
    return;
  }

  // 예약 발행 체크 - 매분
  cron.schedule(schedulerConfig.publishCheck, async () => {
    await runJob("publish", publishJob);
  });

  // 토큰 갱신 - 매시간
  cron.schedule(schedulerConfig.tokenRefresh, async () => {
    await runJob("token-refresh", tokenRefreshJob);
  });

  // 성과 데이터 동기화 - 6시간마다
  cron.schedule(schedulerConfig.analyticsSync, async () => {
    await runJob("analytics-sync", analyticsSyncJob);
  });

  // 댓글/DM 폴링 - 비활성화 (2026-04-14)
  // cron.schedule(schedulerConfig.engagePoll, async () => {
  //   await runJob("engage-poll", engagePollJob);
  // });

  isInitialized = true;
  logger.info("스케줄러 초기화 완료");
}

// Job 실행 래퍼 - 실패해도 다음 실행에 영향 없음
async function runJob(name: string, job: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    logger.debug(`[Job:${name}] 시작`);
    await job();
    logger.debug(`[Job:${name}] 완료 (${Date.now() - start}ms)`);
  } catch (error) {
    logger.error(`[Job:${name}] 실패`, error);
  }
}
