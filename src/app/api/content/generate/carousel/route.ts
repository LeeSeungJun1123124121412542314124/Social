import { apiHandler, successResponse } from "@/lib/api-response";
import { getCarouselGenerator } from "@/ai";
import type { GenerateCarouselInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as GenerateCarouselInput & { generateImages?: boolean };
  const generator = getCarouselGenerator();

  const result = body.generateImages
    ? await generator.generateWithImages(body)
    : await generator.generateSlideTexts(body);

  return successResponse(result);
});
