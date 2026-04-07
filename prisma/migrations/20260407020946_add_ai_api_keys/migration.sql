-- AlterTable
ALTER TABLE "AppSetting" ADD COLUMN     "encryptedAnthropicKey" TEXT,
ADD COLUMN     "encryptedFalKey" TEXT,
ADD COLUMN     "encryptedOpenaiKey" TEXT;
