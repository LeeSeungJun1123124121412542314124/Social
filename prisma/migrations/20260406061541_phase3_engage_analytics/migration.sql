-- AlterTable
ALTER TABLE "AutoReplyRule" ADD COLUMN     "autoSend" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EngageItem" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "platformItemId" TEXT NOT NULL,
    "platformPostId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT,
    "text" TEXT NOT NULL,
    "aiDraft" TEXT,
    "flaggedSales" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoSent" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "snapshotDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EngageItem_platform_status_idx" ON "EngageItem"("platform", "status");

-- CreateIndex
CREATE INDEX "EngageItem_flaggedSales_idx" ON "EngageItem"("flaggedSales");

-- CreateIndex
CREATE INDEX "EngageItem_fetchedAt_idx" ON "EngageItem"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EngageItem_platform_platformItemId_key" ON "EngageItem"("platform", "platformItemId");

-- CreateIndex
CREATE INDEX "AccountAnalyticsSnapshot_platform_snapshotDate_idx" ON "AccountAnalyticsSnapshot"("platform", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAnalyticsSnapshot_accountId_snapshotDate_key" ON "AccountAnalyticsSnapshot"("accountId", "snapshotDate");
