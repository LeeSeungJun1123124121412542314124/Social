import { prisma } from "@/lib/prisma";
import { AppError, ErrorCode } from "@/lib/error";
import type { Post } from "@/generated/prisma/client";
import type { PostStatus } from "@/types/content.types";

// 상태 전이 규칙 - 허용된 전이만 가능
const VALID_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ["scheduled", "published"],
  scheduled: ["draft", "publishing"],
  publishing: ["published", "failed"],
  published: [],
  failed: ["scheduled", "draft"],
  partial: ["scheduled", "draft"],
};

export interface CreatePostInput {
  type: string;
  title?: string;
  contentText?: string;
  contentData?: string; // JSON
  mediaUrls?: string[]; // JSON으로 직렬화
  accountIds?: string[];
}

export interface UpdatePostInput {
  title?: string;
  contentText?: string;
  contentData?: string;
  mediaUrls?: string[];
  scheduledAt?: Date | null;
}

export const contentService = {
  // 게시물 목록 조회
  async getAll(status?: string) {
    return prisma.post.findMany({
      where: status ? { status } : undefined,
      include: {
        postAccounts: { include: { account: true } },
        publishLogs: { orderBy: { attemptedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // 게시물 단건 조회
  async getById(id: string) {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postAccounts: { include: { account: true } },
        publishLogs: { orderBy: { attemptedAt: "desc" } },
        analytics: true,
      },
    });
    if (!post) {
      throw new AppError("게시물을 찾을 수 없습니다.", ErrorCode.CONTENT_NOT_FOUND, 404);
    }
    return post;
  },

  // 게시물 생성
  async create(input: CreatePostInput): Promise<Post> {
    const { accountIds, mediaUrls, ...rest } = input;
    return prisma.post.create({
      data: {
        ...rest,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : undefined,
        postAccounts: accountIds
          ? {
              create: accountIds.map((accountId) => ({ accountId })),
            }
          : undefined,
      },
    });
  },

  // 게시물 수정
  async update(id: string, input: UpdatePostInput): Promise<Post> {
    const { mediaUrls, ...rest } = input;
    return prisma.post.update({
      where: { id },
      data: {
        ...rest,
        mediaUrls: mediaUrls !== undefined ? JSON.stringify(mediaUrls) : undefined,
      },
    });
  },

  // 게시물 삭제
  async delete(id: string): Promise<void> {
    await prisma.post.delete({ where: { id } });
  },

  // 상태 전이 - 유효하지 않은 전이는 에러
  async transitionStatus(id: string, newStatus: PostStatus): Promise<Post> {
    const post = await prisma.post.findUniqueOrThrow({ where: { id } });
    const currentStatus = post.status as PostStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `상태 전이 불가: ${currentStatus} → ${newStatus}`,
        ErrorCode.INVALID_STATUS_TRANSITION,
        400
      );
    }

    return prisma.post.update({
      where: { id },
      data: { status: newStatus },
    });
  },

  // 예약 설정
  async schedule(id: string, scheduledAt: Date, accountIds: string[]): Promise<Post> {
    const post = await prisma.post.findUniqueOrThrow({ where: { id } });
    if (!["draft", "failed", "partial"].includes(post.status)) {
      throw new AppError("임시저장/실패 상태 게시물만 예약할 수 있습니다.", ErrorCode.INVALID_STATUS_TRANSITION, 400);
    }

    return prisma.post.update({
      where: { id },
      data: {
        status: "scheduled",
        scheduledAt,
        postAccounts: {
          deleteMany: {},
          create: accountIds.map((accountId) => ({ accountId })),
        },
      },
    });
  },
};
