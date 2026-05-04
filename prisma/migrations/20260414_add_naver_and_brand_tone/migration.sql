-- AlterTable: AppSetting에 네이버 검색 API 키 + 브랜드 톤 프롬프트 필드 추가
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "encryptedNaverClientId" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "encryptedNaverClientSecret" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "brandTonePrompt" TEXT;
