import { apiHandler, successResponse } from "@/lib/api-response";
import { accountService } from "@/services/account.service";

// 계정 삭제 (비활성화)
export const DELETE = apiHandler(async (_req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  await accountService.deactivate(id);
  return successResponse({ message: "계정 연동이 해제되었습니다." });
});
