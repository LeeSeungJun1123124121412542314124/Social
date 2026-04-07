"use client";

import { PLATFORMS, PLATFORM_TYPES } from "@/lib/constants";
import type { PlatformType } from "@/types/platform.types";

interface PlatformSelectorProps {
  onSelect: (platform: PlatformType) => void;
  disabled?: boolean;
}

export function PlatformSelector({ onSelect, disabled }: PlatformSelectorProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
      {PLATFORM_TYPES.map((platform) => {
        const config = PLATFORMS[platform];
        return (
          <button
            key={platform}
            onClick={() => onSelect(platform)}
            disabled={disabled}
            className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: config.color === "#000000" ? "#333" : config.color }}
            >
              {config.name[0]}
            </div>
            <span className="text-xs font-medium">{config.name}</span>
          </button>
        );
      })}
    </div>
  );
}
