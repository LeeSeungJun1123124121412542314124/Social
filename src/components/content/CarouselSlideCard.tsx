"use client";

import { useState } from "react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";
import type { CarouselSlide } from "@/types/content.types";

interface Props {
  slide: CarouselSlide;
  index: number;
  onChange: (updated: CarouselSlide) => void;
}

export function CarouselSlideCard({ slide, index, onChange }: Props) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 이미지 영역 */}
      <div className="relative bg-muted aspect-square w-full max-w-[200px] mx-auto">
        {slide.imageUrl && !imgError ? (
          <Image
            src={slide.imageUrl}
            alt={`슬라이드 ${index + 1}`}
            fill
            className="object-cover"
            unoptimized={slide.imageUrl.startsWith("https://")}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-1">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <span>{imgError ? "이미지 로드 실패" : "이미지 없음"}</span>
            {imgError && (
              <button
                className="text-primary underline text-[10px]"
                onClick={() => setImgError(false)}
              >
                재시도
              </button>
            )}
          </div>
        )}
        <Badge className="absolute top-2 left-2" variant="secondary">
          {index + 1}
        </Badge>
      </div>

      {/* 텍스트 편집 */}
      <div className="p-3">
        <Textarea
          value={slide.text ?? ""}
          onChange={(e) => onChange({ ...slide, text: e.target.value })}
          rows={3}
          placeholder={`슬라이드 ${index + 1} 텍스트...`}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}
