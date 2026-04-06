import { NextResponse } from "next/server";
import { accountService } from "@/services/account.service";
import { generateCodeVerifier, generateCodeChallenge } from "@/lib/pkce";
import type { PlatformType } from "@/types/platform.types";

// PKCE가 필요한 플랫폼 목록
const PKCE_PLATFORMS: PlatformType[] = ["x", "tiktok"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const state = Math.random().toString(36).substring(2);

  // 302 리다이렉트 응답 생성 (쿠키 설정 후 Location 헤더로 이동)
  const response = new NextResponse(null, { status: 302 });
  let authUrl: string;

  if (PKCE_PLATFORMS.includes(platform as PlatformType)) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    authUrl = accountService.getAuthUrl(platform as PlatformType, state, codeChallenge);
    // code_verifier를 httpOnly 쿠키에 저장 (콜백 시 사용)
    response.cookies.set(`pkce_verifier_${platform}`, codeVerifier, {
      httpOnly: true,
      maxAge: 600, // 10분
      path: "/",
    });
  } else {
    authUrl = accountService.getAuthUrl(platform as PlatformType, state);
  }

  response.headers.set("Location", authUrl);
  return response;
}
