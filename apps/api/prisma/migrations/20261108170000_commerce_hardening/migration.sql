-- CreateEnum
CREATE TYPE "TaxClass" AS ENUM ('standard', 'reduced');
CREATE TYPE "ReturnStatus" AS ENUM ('pending', 'approved', 'received', 'refunded', 'rejected');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused', 'cancelled');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "taxClass" "TaxClass" NOT NULL DEFAULT 'standard';

-- AlterTable ProductVariant
ALTER TABLE "ProductVariant" ADD COLUMN "lowestPrice30d" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN "unitAmountGrams" INTEGER;

-- AlterTable Cart
ALTER TABLE "Cart" ADD COLUMN "email" TEXT;
ALTER TABLE "Cart" ADD COLUMN "abandonedEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Cart" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Cart_email_idx" ON "Cart"("email");
CREATE INDEX "Cart_lastActivityAt_idx" ON "Cart"("lastActivityAt");

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "refundedTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "invoiceNumber" INTEGER;
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "carrier" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- AlterTable OrderLine
ALTER TABLE "OrderLine" ADD COLUMN "taxClass" "TaxClass" NOT NULL DEFAULT 'standard';
ALTER TABLE "OrderLine" ADD COLUMN "taxTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable TaxRate: add taxClass, replace unique
ALTER TABLE "TaxRate" ADD COLUMN "taxClass" "TaxClass" NOT NULL DEFAULT 'standard';
DROP INDEX IF EXISTS "TaxRate_country_key";
CREATE UNIQUE INDEX "TaxRate_country_taxClass_key" ON "TaxRate"("country", "taxClass");

-- ReturnRequest
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'pending',
    "refundAmount" INTEGER,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 30,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "nextOrderAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");
CREATE INDEX "Subscription_status_nextOrderAt_idx" ON "Subscription"("status", "nextOrderAt");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoice sequence
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nextVal" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);
INSERT INTO "InvoiceSequence" ("id", "nextVal") VALUES ('default', 1);
