// src/app/api/content/generate/bulk/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getBulkGenerator } from "@/ai";
import type { BulkInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as BulkInput;
  const generator = await getBulkGenerator();
  const result = await generator.generateIdeas(body);
  return successResponse(result);
});
