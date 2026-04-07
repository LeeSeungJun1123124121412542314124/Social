import { apiHandler, successResponse } from "@/lib/api-response";
import { getTextGenerator } from "@/ai";
import type { GenerateTextInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const input = await req.json() as GenerateTextInput;
  const generator = await getTextGenerator();
  const result = await generator.generatePost(input);
  return successResponse(result);
});
