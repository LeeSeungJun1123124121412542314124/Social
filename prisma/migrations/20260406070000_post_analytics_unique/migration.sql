-- PostAnalytics 테이블에 (postId, platform) 복합 유니크 제약 추가
CREATE UNIQUE INDEX "PostAnalytics_postId_platform_key" ON "PostAnalytics"("postId", "platform");
