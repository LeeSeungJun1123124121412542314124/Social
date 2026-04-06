"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CarouselSlide } from "@/types/content.types";

interface Props {
  slides: CarouselSlide[];
  caption: string;
}

export function CarouselPreview({ slides, caption }: Props) {
  const [current, setCurrent] = useState(0);
  if (slides.length === 0) return null;

  const slide = slides[current]!;

  return (
    <div className="space-y-4">
      {/* 슬라이드 뷰어 */}
      <div className="relative bg-muted rounded-xl aspect-square max-w-sm mx-auto overflow-hidden">
        {slide.imageUrl ? (
          <Image src={slide.imageUrl} alt={`슬라이드 ${current + 1}`} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            이미지 없음
          </div>
        )}

        {/* 슬라이드 텍스트 오버레이 */}
        {slide.text && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-4">
            <p className="text-white text-sm whitespace-pre-wrap">{slide.text}</p>
          </div>
        )}

        {/* 이전/다음 버튼 */}
        {slides.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
              onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))}
              disabled={current === slides.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* 슬라이드 인디케이터 */}
      <div className="flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === current ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>

      {/* 캡션 */}
      {caption && (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-3 bg-muted/30">
          {caption}
        </div>
      )}
    </div>
  );
}
