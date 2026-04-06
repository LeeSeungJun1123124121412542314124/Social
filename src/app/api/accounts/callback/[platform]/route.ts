import { NextRequest, NextResponse } from "next/server";
import { accountService } from "@/services/account.service";
import { logger } from "@/lib/logger";
import type { PlatformType } from "@/types/platform.types";

// PKCE가 필요한 플랫폼 목록
const PKCE_PLATFORMS: PlatformType[] = ["x", "tiktok"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    logger.warn(`OAuth 오류 (${platform}): ${error}`);
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=code_missing`
    );
  }

  try {
    let codeVerifier: string | undefined;
    if (PKCE_PLATFORMS.includes(platform as PlatformType)) {
      // httpOnly 쿠키에서 code_verifier 읽기
      codeVerifier = req.cookies.get(`pkce_verifier_${platform}`)?.value;
    }

    await accountService.connect({
      platform: platform as PlatformType,
      code,
      codeVerifier,
    });

    // 연동 성공 후 PKCE 쿠키 삭제
    const response = NextResponse.redirect(
      `${process.env.APP_URL}/accounts?success=connected`
    );
    response.cookies.delete(`pkce_verifier_${platform}`);
    return response;
  } catch (err) {
    logger.error(`계정 연동 실패 (${platform}):`, err);
    const message = err instanceof Error ? err.message : "연동 실패";
    const errResponse = NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=${encodeURIComponent(message)}`
    );
    errResponse.cookies.delete(`pkce_verifier_${platform}`);
    return errResponse;
  }
}
