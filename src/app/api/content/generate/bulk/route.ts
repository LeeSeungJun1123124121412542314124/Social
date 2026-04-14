// src/app/api/content/generate/bulk/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getBulkGenerator } from "@/ai";
import type { BulkInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as BulkInput;
  const generator = await getBulkGenerator();
  const result = await generator.generateIdeas(body);
  // LLM이 topic을 빈 문자열로 반환하는 경우를 서버 측에서 최종 보정.
  result.ideas = result.ideas.map((idea) => ({
    ...idea,
    topic: idea.topic?.trim() || idea.title?.trim() || "",
  }));
  return successResponse(result);
});
