import { prisma } from "@/lib/prisma";
import { getPlatformAdapter } from "@/adapters";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import type { PlatformType } from "@/types/platform.types";
import type { TextContent } from "@/types/content.types";

// 예약 발행 - 스케줄러에서 호출
export async function processPendingPublishes(): Promise<void> {
  const now = new Date();

  const pendingPosts = await prisma.post.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    include: {
      postAccounts: { include: { account: true } },
    },
  });

  if (pendingPosts.length === 0) return;
  logger.info(`예약 발행 처리: ${pendingPosts.length}개`);

  for (const post of pendingPosts) {
    // publishing 상태로 변경
    await prisma.post.update({
      where: { id: post.id },
      data: { status: "publishing" },
    });

    const results = await Promise.allSettled(
      post.postAccounts.map(async (pa) => {
        const { account } = pa;
        const adapter = getPlatformAdapter(account.platform);

        // 플랫폼별 커스텀 텍스트 또는 기본 콘텐츠
        const platformContent = pa.platformContent
          ? (JSON.parse(pa.platformContent) as TextContent)
          : { text: post.contentText ?? "" };

        const result = await adapter.publishText(account, platformContent);

        // 발행 이력 기록
        await prisma.publishLog.create({
          data: {
            postId: post.id,
            accountId: account.id,
            platform: account.platform,
            success: result.success,
            platformPostId: result.platformPostId,
            platformUrl: result.url,
            error: result.error,
          },
        });

        return { account, result };
      })
    );

    // 결과 집계
    const allSuccess = results.every(
      (r) => r.status === "fulfilled" && r.value.result.success
    );
    const anySuccess = results.some(
      (r) => r.status === "fulfilled" && r.value.result.success
    );

    const finalStatus = allSuccess
      ? "published"
      : anySuccess
      ? "partial"
      : "failed";

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: finalStatus,
        publishedAt: anySuccess ? now : undefined,
      },
    });

    // 실패 시 알림 생성
    if (!allSuccess) {
      const failedPlatforms = results
        .filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.result.success))
        .map((r) => (r.status === "fulfilled" ? r.value.account.platform : "unknown"))
        .join(", ");

      await prisma.notification.create({
        data: {
          type: "publish_fail",
          title: "발행 실패",
          message: `게시물 발행이 일부 실패했습니다. (${failedPlatforms})`,
          metadata: JSON.stringify({ postId: post.id }),
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          type: "publish_success",
          title: "발행 완료",
          message: `게시물이 성공적으로 발행되었습니다. (${post.postAccounts.map((pa) => pa.account.platform).join(", ")})`,
          metadata: JSON.stringify({ postId: post.id }),
        },
      });
    }

    logger.info(`발행 완료: postId=${post.id}, status=${finalStatus}`);
  }
}

// 즉시 발행 (단일 계정)
export async function publishNow(
  postId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } });

  const adapter = getPlatformAdapter(account.platform as PlatformType);
  const content: TextContent = { text: post.contentText ?? "" };

  const result = await adapter.publishText(account, content);

  await prisma.publishLog.create({
    data: {
      postId,
      accountId,
      platform: account.platform,
      success: result.success,
      platformPostId: result.platformPostId,
      platformUrl: result.url,
      error: result.error,
    },
  });

  if (result.success) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: "published", publishedAt: new Date() },
    });
  }

  return result;
}
