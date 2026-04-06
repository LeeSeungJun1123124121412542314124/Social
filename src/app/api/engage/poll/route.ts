import { apiHandler, successResponse } from "@/lib/api-response";
import { engageService } from "@/services/engage.service";

// X 플랫폼 수동 폴링
export const POST = apiHandler(async (req) => {
  const body = await req.json() as { platform?: string };
  const platform = body.platform ?? "x";
  await engageService.pollManual(platform);
  if (platform === "x") {
    // X 플랫폼 실제 수집은 Phase 4에서 구현 예정
    return successResponse({ ok: true, message: "X 플랫폼 수동 갱신이 요청되었습니다. (실제 수집은 Phase 4에서 구현 예정)" });
  }
  return successResponse({ ok: true });
});
