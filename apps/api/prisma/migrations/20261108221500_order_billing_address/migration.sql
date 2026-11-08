-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingAddress" JSONB;
