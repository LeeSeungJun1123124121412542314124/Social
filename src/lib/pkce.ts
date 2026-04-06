import { createHash, randomBytes } from "crypto";
import type { PlatformType } from "@/types/platform.types";

// code_verifier 생성 (43~128자 base64url)
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

// code_challenge 생성 (S256 방식)
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// PKCE가 필요한 플랫폼 목록 (auth/callback 라우트에서 공유)
export const PKCE_PLATFORMS: PlatformType[] = ["x", "tiktok"];
