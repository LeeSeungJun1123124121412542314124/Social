import { apiHandler, successResponse } from "@/lib/api-response";
import { settingsService } from "@/services/settings.service";
import type { UpdateAISettingsInput } from "@/services/settings.service";

// GET: 현재 AI 설정 조회 (키 값은 노출 안함, 설정 여부만)
export const GET = apiHandler(async () => {
  const settings = await settingsService.getAISettings();
  return successResponse(settings);
});

// PUT: AI 설정 변경 (provider 선택 및 API 키 저장)
export const PUT = apiHandler(async (req) => {
  const body = await req.json() as UpdateAISettingsInput;
  const updated = await settingsService.updateAISettings(body);
  return successResponse(updated);
});
