import { NextResponse } from "next/server";
import { accountService } from "@/services/account.service";
import { generateCodeVerifier, generateCodeChallenge, PKCE_PLATFORMS } from "@/lib/pkce";
import type { PlatformType } from "@/types/platform.types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const state = Math.random().toString(36).substring(2);

  // 쿠키 보관용 임시 응답 (headers 추출 후 실제 리다이렉트에 전달)
  const cookieHolder = NextResponse.redirect(new URL("http://placeholder"));
  let authUrl: string;

  if (PKCE_PLATFORMS.includes(platform as PlatformType)) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    authUrl = accountService.getAuthUrl(platform as PlatformType, state, codeChallenge);
    // code_verifier를 httpOnly 쿠키에 저장 (콜백 시 사용, 10분 만료)
    cookieHolder.cookies.set(`pkce_verifier_${platform}`, codeVerifier, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  } else {
    authUrl = accountService.getAuthUrl(platform as PlatformType, state);
  }

  return NextResponse.redirect(authUrl, { headers: cookieHolder.headers });
}
