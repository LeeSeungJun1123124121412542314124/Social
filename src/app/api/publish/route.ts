import { apiHandler, successResponse } from "@/lib/api-response";
import { publishNow } from "@/services/publish.service";

// 즉시 발행
export const POST = apiHandler(async (req) => {
  const { postId, accountId } = await req.json() as { postId: string; accountId: string };
  const result = await publishNow(postId, accountId);
  return successResponse(result);
});
