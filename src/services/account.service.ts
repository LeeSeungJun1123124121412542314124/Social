import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { AppError, ErrorCode } from "@/lib/error";
import { getPlatformAdapter } from "@/adapters";
import { logger } from "@/lib/logger";
import type { SocialAccount } from "@/generated/prisma/client";
import type { PlatformType } from "@/types/platform.types";

export interface ConnectAccountInput {
  platform: PlatformType;
  code: string;
  codeVerifier?: string;
}

export interface AccountDTO {
  id: string;
  platform: string;
  profileName: string;
  profileImage: string | null;
  profileUrl: string | null;
  followerCount: number;
  tokenExpiresAt: Date | null;
  isActive: boolean;
  connectedAt: Date;
}

function toDTO(account: SocialAccount): AccountDTO {
  return {
    id: account.id,
    platform: account.platform,
    profileName: account.profileName,
    profileImage: account.profileImage,
    profileUrl: account.profileUrl,
    followerCount: account.followerCount,
    tokenExpiresAt: account.tokenExpiresAt,
    isActive: account.isActive,
    connectedAt: account.connectedAt,
  };
}

export const accountService = {
  // 모든 활성 계정 조회
  async getAll(): Promise<AccountDTO[]> {
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
      orderBy: { connectedAt: "desc" },
    });
    return accounts.map(toDTO);
  },

  // 계정 연동 (OAuth 코드 교환)
  async connect(input: ConnectAccountInput): Promise<AccountDTO> {
    const adapter = getPlatformAdapter(input.platform);

    // 토큰 교환
    const tokenResult = await adapter.exchangeToken(input.code, input.codeVerifier);

    // 프로필 조회
    const profile = await adapter.getProfile(tokenResult.accessToken);

    // 이미 연동된 계정 확인 (soft delete된 계정 포함)
    const existing = await prisma.socialAccount.findFirst({
      where: {
        platform: input.platform,
        profileName: profile.profileName,
      },
    });

    const encryptedAccessToken = encrypt(tokenResult.accessToken);
    const encryptedRefreshToken = tokenResult.refreshToken
      ? encrypt(tokenResult.refreshToken)
      : null;

    let account: SocialAccount;

    if (existing) {
      // 기존 계정 업데이트 (재연동)
      account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          encryptedAccessToken,
          encryptedRefreshToken: encryptedRefreshToken ?? undefined,
          profileImage: profile.profileImage,
          profileUrl: profile.profileUrl,
          followerCount: profile.followerCount,
          tokenExpiresAt: tokenResult.expiresAt,
          isActive: true,
        },
      });
      logger.info(`계정 재연동: ${input.platform}/${profile.profileName}`);
    } else {
      // 신규 계정 생성
      account = await prisma.socialAccount.create({
        data: {
          platform: input.platform,
          encryptedAccessToken,
          encryptedRefreshToken: encryptedRefreshToken ?? undefined,
          profileName: profile.profileName,
          profileImage: profile.profileImage,
          profileUrl: profile.profileUrl,
          followerCount: profile.followerCount,
          tokenExpiresAt: tokenResult.expiresAt,
        },
      });
      logger.info(`계정 연동: ${input.platform}/${profile.profileName}`);
    }

    return toDTO(account);
  },

  // 계정 삭제 (soft delete)
  async deactivate(id: string): Promise<void> {
    const account = await prisma.socialAccount.findUnique({ where: { id } });
    if (!account) {
      throw new AppError("계정을 찾을 수 없습니다.", ErrorCode.ACCOUNT_NOT_FOUND, 404);
    }
    await prisma.socialAccount.update({
      where: { id },
      data: { isActive: false },
    });
    logger.info(`계정 비활성화: ${account.platform}/${account.profileName}`);
  },

  // 토큰 갱신 (스케줄러에서 호출)
  async refreshExpiredTokens(): Promise<void> {
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일 이내 만료
    const accounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: { lte: soon },
      },
    });

    for (const account of accounts) {
      try {
        const adapter = getPlatformAdapter(account.platform);
        const currentToken = decrypt(account.encryptedAccessToken);
        const newToken = await adapter.refreshToken(currentToken);

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            encryptedAccessToken: encrypt(newToken.accessToken),
            encryptedRefreshToken: newToken.refreshToken
              ? encrypt(newToken.refreshToken)
              : undefined,
            tokenExpiresAt: newToken.expiresAt,
          },
        });
        logger.info(`토큰 갱신 완료: ${account.platform}/${account.profileName}`);
      } catch (err) {
        logger.error(
          `토큰 갱신 실패: ${account.platform}/${account.profileName}`,
          err
        );
        // 갱신 실패 시 알림 생성
        await prisma.notification.create({
          data: {
            type: "token_expiry",
            title: "토큰 만료 임박",
            message: `${account.platform} 계정(${account.profileName})의 토큰이 곧 만료됩니다. 재연동이 필요합니다.`,
            metadata: JSON.stringify({ accountId: account.id }),
          },
        });
      }
    }
  },

  // OAuth 시작 URL 생성
  getAuthUrl(platform: PlatformType, state?: string, codeChallenge?: string): string {
    const adapter = getPlatformAdapter(platform);
    return adapter.getAuthUrl(state, codeChallenge);
  },
};
