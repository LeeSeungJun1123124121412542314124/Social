import { apiHandler, successResponse } from "@/lib/api-response";
import { getLLMProvider, getImageProvider } from "@/ai";
import { CarouselGenerator } from "@/ai/generators/carousel.generator";
import type { GenerateCarouselInput } from "@/types/content.types";

export const POST = apiHandler(async (req) => {
  const body = await req.json() as GenerateCarouselInput & {
    generateImages?: boolean;
    imageProvider?: "pollinations" | "dalle" | "flux";
  };

  const llm = await getLLMProvider();

  if (body.generateImages) {
    // 요청에서 imageProvider 지정하면 그걸 사용, 없으면 설정 값 사용
    const imageProvider = await getImageProvider(body.imageProvider);
    const generator = new CarouselGenerator(llm, imageProvider);
    return successResponse(await generator.generateWithImages(body));
  } else {
    // 텍스트만 생성 — 이미지 provider 불필요 (더미 사용)
    const dummyImage = { name: "none", async generateImage() { return { urls: [] }; } };
    const generator = new CarouselGenerator(llm, dummyImage);
    return successResponse(await generator.generateSlideTexts(body));
  }
});
