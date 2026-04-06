// src/services/engage.service.ts
import { prisma } from "@/lib/prisma";
import { getPlatformAdapter } from "@/adapters";
import { getLLMProvider } from "@/ai";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/error";
import type { SocialAccount, AutoReplyRule, EngageItem } from "@/generated/prisma/client";

// 폴링 제외 플랫폼 (API 한도 문제)
const POLL_EXCLUDED_PLATFORMS = ["x"];

// 세일즈 키워드 기본값 (AutoReplyRule.salesKeywords가 없을 때)
const DEFAULT_SALES_KEYWORDS = ["예약", "가격", "비용", "상담", "문의", "얼마"];

export const engageService = {
  /**
   * 특정 계정의 댓글/DM을 수집하고 AI 초안을 생성한다.
   * 에러 발생 시 로그만 남기고 계속 진행 (폴링 중단 방지).
   */
  async pollAndProcess(account: SocialAccount): Promise<void> {
    if (POLL_EXCLUDED_PLATFORMS.includes(account.platform)) return;

    try {
      const adapter = getPlatformAdapter(account.platform);

      // 최근 7일 게시물의 댓글 수집
      const recentLogs = await prisma.publishLog.findMany({
        where: {
          accountId: account.id,
          success: true,
          attemptedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          platformPostId: { not: null },
        },
        select: { platformPostId: true },
        distinct: ["platformPostId"],
      });

      const newItems: Array<{
        platform: string;
        triggerType: string;
        platformItemId: string;
        platformPostId?: string;
        authorId?: string;
        authorName?: string;
        text: string;
      }> = [];

      // 댓글 수집
      for (const log of recentLogs) {
        if (!log.platformPostId) continue;
        try {
          const comments = await adapter.getComments(account, log.platformPostId);
          for (const c of comments) {
            newItems.push({
              platform: account.platform,
              triggerType: "comment",
              platformItemId: c.id,
              platformPostId: log.platformPostId,
              authorId: c.authorId,
              authorName: c.authorName,
              text: c.text,
            });
          }
        } catch (e) {
          logger.warn(`댓글 수집 실패 (${account.platform}/${log.platformPostId}):`, e);
        }
      }

      // DM 수집
      try {
        const messages = await adapter.getMessages(account);
        for (const m of messages) {
          if (m.isFromMe) continue;
          newItems.push({
            platform: account.platform,
            triggerType: "dm",
            platformItemId: m.id,
            authorId: m.senderId,
            authorName: m.senderName,
            text: m.text,
          });
        }
      } catch (e) {
        logger.warn(`DM 수집 실패 (${account.platform}):`, e);
      }

      // 자동응답 규칙 로드
      const rules = await prisma.autoReplyRule.findMany({
        where: { platform: account.platform, isActive: true },
      });

      // 신규 항목만 처리 (@@unique로 upsert 시 기존은 스킵)
      for (const item of newItems) {
        try {
          await this._processItem(item, rules, account);
        } catch (e) {
          logger.warn(`항목 처리 실패 (${item.platformItemId}):`, e);
        }
      }
    } catch (e) {
      logger.error(`pollAndProcess 실패 (${account.platform}/${account.id}):`, e);
    }
  },

  async _processItem(
    raw: {
      platform: string; triggerType: string; platformItemId: string;
      platformPostId?: string; authorId?: string; authorName?: string; text: string;
    },
    rules: AutoReplyRule[],
    account: SocialAccount,
  ): Promise<void> {
    // 이미 존재하면 스킵
    const exists = await prisma.engageItem.findUnique({
      where: { platform_platformItemId: { platform: raw.platform, platformItemId: raw.platformItemId } },
    });
    if (exists) return;

    // 세일즈 키워드 감지 (rules가 빈 배열이면 기본값 사용)
    const allSalesKw = rules.length > 0
      ? rules.flatMap(r =>
          r.salesKeywords ? (JSON.parse(r.salesKeywords) as string[]) : DEFAULT_SALES_KEYWORDS
        )
      : DEFAULT_SALES_KEYWORDS;
    const flaggedSales = allSalesKw.some(kw => raw.text.includes(kw));

    // AI 초안 생성
    let aiDraft: string | null = null;
    try {
      const llm = getLLMProvider();
      aiDraft = await llm.generateText(
        `당신은 병원 SNS 관리자입니다. 아래 ${raw.triggerType === "comment" ? "댓글" : "DM"}에 친절하고 전문적인 한국어로 80자 이내로 답변해주세요.\n\n원문: "${raw.text}"\n\n답변:`,
        { maxTokens: 150 }
      );
    } catch (e) {
      logger.warn("AI 초안 생성 실패:", e);
    }

    // DB 저장
    const created = await prisma.engageItem.create({
      data: {
        platform: raw.platform,
        triggerType: raw.triggerType,
        platformItemId: raw.platformItemId,
        platformPostId: raw.platformPostId,
        authorId: raw.authorId,
        authorName: raw.authorName,
        text: raw.text,
        aiDraft,
        flaggedSales,
      },
    });

    // 세일즈 감지 시 알림 생성
    if (flaggedSales) {
      await prisma.notification.create({
        data: {
          type: "sales_lead",
          title: "세일즈 문의 감지",
          message: `[${raw.platform}] ${raw.authorName ?? "익명"}: "${raw.text.slice(0, 50)}..."`,
          metadata: JSON.stringify({ engageItemId: created.id }),
        },
      });
    }

    // autoSend 규칙 확인
    const matchedAutoRule = rules.find(r => {
      if (!r.autoSend) return false;
      if (r.triggerType !== raw.triggerType) return false;
      if (!r.keywords) return true; // 키워드 없으면 모두 매칭
      const kws = JSON.parse(r.keywords) as string[];
      return kws.some(kw => raw.text.includes(kw));
    });

    if (matchedAutoRule && aiDraft) {
      try {
        const adapter = getPlatformAdapter(raw.platform);
        if (raw.triggerType === "comment" && raw.platformPostId) {
          await adapter.replyToComment(account, raw.platformItemId, aiDraft);
        } else if (raw.triggerType === "dm" && raw.authorId) {
          await adapter.sendMessage(account, raw.authorId, aiDraft);
        }
        await prisma.engageItem.update({
          where: { id: created.id },
          data: { status: "replied", autoSent: true, repliedAt: new Date() },
        });
      } catch (e) {
        logger.warn("자동 발송 실패:", e);
      }
    }
  },

  async listItems(filters: {
    platform?: string;
    status?: string;
    triggerType?: string;
    page?: number;
  }): Promise<{ items: EngageItem[]; total: number }> {
    const page = filters.page ?? 1;
    const take = 30;
    const skip = (page - 1) * take;

    const where = {
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.status === "sales" ? { flaggedSales: true, status: "pending" } : filters.status ? { status: filters.status } : {}),
      ...(filters.triggerType ? { triggerType: filters.triggerType } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.engageItem.findMany({ where, orderBy: { fetchedAt: "desc" }, take, skip }),
      prisma.engageItem.count({ where }),
    ]);
    return { items, total };
  },

  async sendReply(id: string, text: string): Promise<void> {
    const item = await prisma.engageItem.findUnique({ where: { id } });
    if (!item) throw new AppError("항목을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404);
    if (item.status === "replied") throw new AppError("이미 답변된 항목입니다.", ErrorCode.VALIDATION_ERROR, 400);

    const account = await prisma.socialAccount.findFirst({
      where: { platform: item.platform, isActive: true },
    });
    if (!account) throw new AppError("연동된 계정이 없습니다.", ErrorCode.ACCOUNT_NOT_FOUND, 404);

    const adapter = getPlatformAdapter(item.platform);
    if (item.triggerType === "comment" && item.platformPostId) {
      await adapter.replyToComment(account, item.platformItemId, text);
    } else if (item.triggerType === "dm" && item.authorId) {
      await adapter.sendMessage(account, item.authorId, text);
    }

    await prisma.engageItem.update({
      where: { id },
      data: { status: "replied", aiDraft: text, repliedAt: new Date() },
    });
  },

  async updateItem(id: string, patch: { aiDraft?: string; status?: string }): Promise<EngageItem> {
    return prisma.engageItem.update({ where: { id }, data: patch });
  },

  // X 플랫폼: pollAndProcess 내에서 POLL_EXCLUDED_PLATFORMS 체크로 스킵됨
  // TODO(Phase 4): X API 직접 수집 로직 추가 필요
  async pollManual(platform: string): Promise<void> {
    const accounts = await prisma.socialAccount.findMany({
      where: { platform, isActive: true },
    });
    for (const account of accounts) {
      await this.pollAndProcess(account);
    }
  },
};
