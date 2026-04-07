// src/app/api/content/generate/repurpose/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getRepurposeGenerator } from "@/ai";
import type { RepurposeInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as RepurposeInput;
  const generator = await getRepurposeGenerator();
  const results = await generator.repurpose(body);
  return successResponse(results);
});
