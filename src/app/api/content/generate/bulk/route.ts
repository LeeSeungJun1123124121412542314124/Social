// src/app/api/content/generate/bulk/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getBulkGenerator } from "@/ai";
import type { PlatformType } from "@/types/platform.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as {
    theme: string;
    count: number;
    platforms: PlatformType[];
    period?: string;
  };
  const generator = getBulkGenerator();
  const result = await generator.generateIdeas(body);
  return successResponse(result);
});
