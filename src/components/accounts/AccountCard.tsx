"use client";

import { Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PLATFORMS } from "@/lib/constants";
import type { PlatformType } from "@/types/platform.types";

interface AccountCardProps {
  id: string;
  platform: string;
  profileName: string;
  profileImage: string | null;
  followerCount: number;
  tokenExpiresAt: Date | null;
  onDelete: (id: string) => void;
}

export function AccountCard({
  id,
  platform,
  profileName,
  profileImage,
  followerCount,
  tokenExpiresAt,
  onDelete,
}: AccountCardProps) {
  const platformConfig = PLATFORMS[platform as PlatformType];
  const isExpiringSoon =
    tokenExpiresAt && tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <Card
      className="overflow-hidden shadow-sm"
      style={{
        borderLeftWidth: "3px",
        borderLeftStyle: "solid",
        borderLeftColor: platformConfig?.color === "#000000" ? "#333" : (platformConfig?.color ?? "#6b7280"),
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={profileImage ?? undefined} alt={profileName} />
              <AvatarFallback
                style={{
                  backgroundColor:
                    platformConfig?.color === "#000000"
                      ? "#333"
                      : platformConfig?.color,
                  color: "#fff",
                }}
              >
                {profileName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{profileName}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {platformConfig?.name ?? platform}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Users className="h-3 w-3" />
                <span>{followerCount.toLocaleString()} 팔로워</span>
              </div>
              {isExpiringSoon && (
                <Badge variant="destructive" className="text-xs mt-1">
                  토큰 만료 임박
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(id)}
            aria-label="연동 해제"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
