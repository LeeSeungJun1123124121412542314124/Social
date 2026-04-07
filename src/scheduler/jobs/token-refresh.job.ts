import { accountService } from "@/services/account.service";

// 토큰 갱신 Job - 매시간 실행
// 7일 이내 만료 예정 토큰을 갱신
export async function tokenRefreshJob(): Promise<void> {
  await accountService.refreshExpiredTokens();
}
