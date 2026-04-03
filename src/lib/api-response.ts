import { NextResponse } from "next/server";
import { AppError } from "./error";
import { logger } from "./logger";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    logger.warn(`[${error.code}] ${error.message}`);
    return NextResponse.json(
      {
        success: false,
        error: { code: error.code, message: error.message },
      },
      { status: error.statusCode }
    );
  }

  logger.error("예상하지 못한 에러", error);
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
    },
    { status: 500 }
  );
}

// API Route try-catch 반복 제거용 래퍼
export function apiHandler(
  handler: (req: Request, ctx?: unknown) => Promise<NextResponse>
) {
  return async (req: Request, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
