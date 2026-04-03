// 모든 에러 코드를 한 곳에서 관리
export const ErrorCode = {
  // 공통
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // 계정
  OAUTH_FAILED: "OAUTH_FAILED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",
  UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",

  // 콘텐츠
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  CONTENT_TOO_LONG: "CONTENT_TOO_LONG",
  CONTENT_NOT_FOUND: "CONTENT_NOT_FOUND",

  // 발행
  PUBLISH_FAILED: "PUBLISH_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  NO_TARGET_ACCOUNTS: "NO_TARGET_ACCOUNTS",

  // AI
  AI_GENERATION_FAILED: "AI_GENERATION_FAILED",
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCodeType,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}
