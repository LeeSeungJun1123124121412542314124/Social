import { apiHandler, successResponse } from "@/lib/api-response";
import { getCarouselGenerator, getLLMOnlyCarouselGenerator } from "@/ai";
import type { GenerateCarouselInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as GenerateCarouselInput & { generateImages?: boolean };

  // 이미지 생성 여부에 따라 generator 선택
  // generateImages=false면 이미지 API 키 없어도 동작
  const generator = body.generateImages
    ? await getCarouselGenerator()
    : await getLLMOnlyCarouselGenerator();

  const result = body.generateImages
    ? await generator.generateWithImages(body)
    : await generator.generateSlideTexts(body);

  return successResponse(result);
});
