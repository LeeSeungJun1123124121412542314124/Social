// src/app/api/content/generate/blog/route.ts
import { apiHandler, successResponse } from "@/lib/api-response";
import { getBlogGenerator } from "@/ai";
import type { GenerateBlogInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as GenerateBlogInput;
  const generator = await getBlogGenerator();
  const result = await generator.generateBlog(body);
  return successResponse(result);
});
