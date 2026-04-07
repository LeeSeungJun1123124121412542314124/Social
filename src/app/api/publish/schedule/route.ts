import { apiHandler, successResponse } from "@/lib/api-response";
import { contentService } from "@/services/content.service";

// 예약 발행 설정
export const POST = apiHandler(async (req) => {
  const { postId, scheduledAt, accountIds } = await req.json() as {
    postId: string;
    scheduledAt: string;
    accountIds: string[];
  };

  const post = await contentService.schedule(
    postId,
    new Date(scheduledAt),
    accountIds
  );
  return successResponse(post);
});
