-- CreateEnum
CREATE TYPE "CustomerIdentityProvider" AS ENUM ('google', 'apple', 'email');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "emailNormalized" TEXT;
ALTER TABLE "Customer" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

UPDATE "Customer" SET "emailNormalized" = lower(trim("email")) WHERE "emailNormalized" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "emailNormalized" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "firstName" DROP NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "lastName" DROP NOT NULL;
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "passwordHash";

CREATE UNIQUE INDEX "Customer_emailNormalized_key" ON "Customer"("emailNormalized");

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "provider" "CustomerIdentityProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerOtpChallenge" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'sign_in',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerRefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerIdentity_provider_providerSubject_key" ON "CustomerIdentity"("provider", "providerSubject");
CREATE INDEX "CustomerIdentity_customerId_idx" ON "CustomerIdentity"("customerId");
CREATE INDEX "CustomerOtpChallenge_emailNormalized_purpose_idx" ON "CustomerOtpChallenge"("emailNormalized", "purpose");
CREATE UNIQUE INDEX "CustomerRefreshToken_tokenHash_key" ON "CustomerRefreshToken"("tokenHash");
CREATE INDEX "CustomerRefreshToken_customerId_idx" ON "CustomerRefreshToken"("customerId");
CREATE INDEX "CustomerRefreshToken_familyId_idx" ON "CustomerRefreshToken"("familyId");

ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerRefreshToken" ADD CONSTRAINT "CustomerRefreshToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
