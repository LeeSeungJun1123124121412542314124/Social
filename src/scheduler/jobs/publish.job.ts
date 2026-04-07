import { processPendingPublishes } from "@/services/publish.service";

// 예약 발행 Job - 매분 실행
// 시간이 도래한 scheduled 게시물을 찾아 발행
export async function publishJob(): Promise<void> {
  await processPendingPublishes();
}
