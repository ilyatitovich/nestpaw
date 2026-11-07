-- CreateEnum
CREATE TYPE "NewsletterSubscriberStatus" AS ENUM ('pending', 'confirmed', 'unsubscribed');

-- CreateEnum
CREATE TYPE "NewsletterCampaignStatus" AS ENUM ('draft', 'sending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "NewsletterRecipientStatus" AS ENUM ('queued', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "NewsletterSubscriberStatus" NOT NULL DEFAULT 'pending',
    "confirmTokenHash" TEXT,
    "unsubscribeTokenHash" TEXT,
    "source" TEXT NOT NULL DEFAULT 'storefront',
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "NewsletterCampaignStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "status" "NewsletterRecipientStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_status_idx" ON "NewsletterSubscriber"("status");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_confirmTokenHash_idx" ON "NewsletterSubscriber"("confirmTokenHash");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_unsubscribeTokenHash_idx" ON "NewsletterSubscriber"("unsubscribeTokenHash");

-- CreateIndex
CREATE INDEX "NewsletterCampaign_status_idx" ON "NewsletterCampaign"("status");

-- CreateIndex
CREATE INDEX "NewsletterCampaign_createdById_idx" ON "NewsletterCampaign"("createdById");

-- CreateIndex
CREATE INDEX "NewsletterCampaignRecipient_status_idx" ON "NewsletterCampaignRecipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterCampaignRecipient_campaignId_subscriberId_key" ON "NewsletterCampaignRecipient"("campaignId", "subscriberId");

-- AddForeignKey
ALTER TABLE "NewsletterCampaign" ADD CONSTRAINT "NewsletterCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterCampaignRecipient" ADD CONSTRAINT "NewsletterCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterCampaignRecipient" ADD CONSTRAINT "NewsletterCampaignRecipient_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "NewsletterSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
