import { apiHandler, successResponse } from "@/lib/api-response";
import { settingsService } from "@/services/settings.service";
import { AppError, ErrorCode } from "@/lib/error";

// POST: AI provider 연결 테스트
export const POST = apiHandler(async (req) => {
  const { provider } = await req.json() as { provider: string };

  if (!provider) {
    throw new AppError("provider는 필수입니다.", ErrorCode.VALIDATION_ERROR, 400);
  }

  const validProviders = ["openai", "anthropic", "flux", "dalle"];
  if (!validProviders.includes(provider)) {
    throw new AppError(`유효하지 않은 provider: ${provider}`, ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await settingsService.testConnection(provider as "openai" | "anthropic" | "flux" | "dalle");
  return successResponse(result);
});
