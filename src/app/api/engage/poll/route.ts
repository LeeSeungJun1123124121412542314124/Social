import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

// X 플랫폼 수동 폴링
export const POST = apiHandler(async (req) => {
  const body = await req.json() as { platform?: string };
  const platform = body.platform ?? "x";
  await engageService.pollManual(platform);
  return successResponse({ ok: true });
});
