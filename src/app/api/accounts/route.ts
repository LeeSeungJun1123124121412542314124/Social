import { apiHandler, successResponse } from "@/lib/api-response";
import { accountService } from "@/services/account.service";

// 계정 목록 조회
export const GET = apiHandler(async () => {
  const accounts = await accountService.getAll();
  return successResponse(accounts);
});
