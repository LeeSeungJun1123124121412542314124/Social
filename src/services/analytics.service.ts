// src/services/analytics.service.ts
import { prisma } from "@/lib/prisma";
import { getPlatformAdapter } from "@/adapters";
import { getLLMProvider } from "@/ai";
import { logger } from "@/lib/logger";
import type { SocialAccount } from "@/generated/prisma/client";

function toMidnight(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

export const analyticsService = {
  /**
   * 계정의 발행된 게시물 성과를 수집해 PostAnalytics에 저장한다.
   */
  async syncPostAnalytics(account: SocialAccount): Promise<void> {
    try {
      const adapter = getPlatformAdapter(account.platform);
      const logs = await prisma.publishLog.findMany({
        where: { accountId: account.id, success: true, platformPostId: { not: null } },
        select: { postId: true, platformPostId: true },
      });

      for (const log of logs) {
        if (!log.platformPostId) continue;
        try {
          const analytics = await adapter.getPostAnalytics(account, log.platformPostId);
          await prisma.postAnalytics.upsert({
            where: { postId_platform: { postId: log.postId, platform: account.platform } },
            update: { ...analytics, fetchedAt: new Date() },
            create: {
              postId: log.postId,
              platform: account.platform,
              ...analytics,
            },
          });
        } catch (e) {
          logger.warn(`게시물 분석 수집 실패 (${log.platformPostId}):`, e);
        }
      }
    } catch (e) {
      logger.error(`syncPostAnalytics 실패 (${account.platform}):`, e);
    }
  },

  /**
   * 계정 레벨 오늘 스냅샷을 저장한다 (하루 1회 upsert).
   */
  async syncAccountSnapshot(account: SocialAccount): Promise<void> {
    try {
      const adapter = getPlatformAdapter(account.platform);
      const result = await adapter.getAccountAnalytics(account, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
      });
      const snapshotDate = toMidnight(new Date());

      await prisma.accountAnalyticsSnapshot.upsert({
        where: { accountId_snapshotDate: { accountId: account.id, snapshotDate } },
        update: {
          followers: account.followerCount,
          impressions: result.totalImpressions,
          reach: result.totalReach,
          engagement: result.totalEngagement,
        },
        create: {
          accountId: account.id,
          platform: account.platform,
          followers: account.followerCount,
          impressions: result.totalImpressions,
          reach: result.totalReach,
          engagement: result.totalEngagement,
          snapshotDate,
        },
      });
    } catch (e) {
      logger.error(`syncAccountSnapshot 실패 (${account.platform}):`, e);
    }
  },

  /**
   * 대시보드용 집계 데이터 반환.
   * platform = "all" 이면 전체 플랫폼 합산.
   */
  async getDashboard(platform: string, days: number): Promise<{
    snapshots: Array<{ snapshotDate: Date; impressions: number; reach: number; followers: number; platform: string }>;
    topPosts: Array<{ postId: string; platform: string; impressions: number; likes: number; title: string | null }>;
    summary: { totalImpressions: number; totalReach: number; followerGrowth: number };
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshotWhere = platform === "all"
      ? { snapshotDate: { gte: since } }
      : { platform, snapshotDate: { gte: since } };

    const snapshots = await prisma.accountAnalyticsSnapshot.findMany({
      where: snapshotWhere,
      orderBy: { snapshotDate: "asc" },
      select: { snapshotDate: true, impressions: true, reach: true, followers: true, platform: true },
    });

    const analyticsWhere = platform === "all" ? {} : { platform };
    const topPosts = await prisma.postAnalytics.findMany({
      where: analyticsWhere,
      orderBy: { impressions: "desc" },
      take: 5,
      include: { post: { select: { title: true } } },
    });

    const latestSnapshots = snapshots.slice(-1);
    const earliestSnapshots = snapshots.slice(0, 1);
    const totalImpressions = snapshots.reduce((s, v) => s + v.impressions, 0);
    const totalReach = snapshots.reduce((s, v) => s + v.reach, 0);
    const followerGrowth =
      (latestSnapshots[0]?.followers ?? 0) - (earliestSnapshots[0]?.followers ?? 0);

    return {
      snapshots,
      topPosts: topPosts.map(a => ({
        postId: a.postId,
        platform: a.platform,
        impressions: a.impressions,
        likes: a.likes,
        title: a.post.title,
      })),
      summary: { totalImpressions, totalReach, followerGrowth },
    };
  },

  /**
   * 지난 7일 성과를 기반으로 AI 주간 리포트를 생성한다.
   */
  async generateWeeklyReport(): Promise<string> {
    const dashboard = await this.getDashboard("all", 7);
    const llm = getLLMProvider();

    const context = `
[지난 7일 SNS 성과 요약]
- 총 노출: ${dashboard.summary.totalImpressions.toLocaleString()}회
- 총 도달: ${dashboard.summary.totalReach.toLocaleString()}명
- 팔로워 증감: ${dashboard.summary.followerGrowth >= 0 ? "+" : ""}${dashboard.summary.followerGrowth}명
- TOP 게시물: ${dashboard.topPosts.map(p => `"${p.title ?? "제목없음"}" (노출 ${p.impressions})`).join(", ")}
`.trim();

    return llm.generateText(
      `당신은 병원 SNS 마케팅 전문가입니다. 아래 데이터를 바탕으로 한국어로 주간 성과 리포트를 작성해주세요.\n잘된 점, 개선점, 다음 주 추천 콘텐츠 방향 3가지를 각각 간략히 정리해주세요.\n\n${context}`,
      { maxTokens: 500 }
    );
  },
};
