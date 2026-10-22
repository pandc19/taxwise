-- ADR-017: supplier rules store relevance instead of a category; add the global
-- supplier_profiles table and the taxpayer's work profile. Development data in
-- supplier_rules is not migrated (its category cannot be turned into a relevance
-- without guessing), so it is cleared first.
TRUNCATE TABLE "supplier_rules"; -- not DELETE: FORCE RLS would hide every row from the migration role

-- CreateEnum
CREATE TYPE "PurchaseTreatment" AS ENUM ('CLAIM_CREDIT', 'DEDUCT_AS_EXPENSE');

-- CreateEnum
CREATE TYPE "Relevance" AS ENUM ('RELATED', 'NOT_RELATED');

-- AlterTable
ALTER TABLE "supplier_rules" DROP COLUMN "iva_category",
ADD COLUMN     "confidence" DECIMAL(3,2),
ADD COLUMN     "model_id" TEXT,
ADD COLUMN     "profile_hash" TEXT,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "relevance" "Relevance" NOT NULL;

-- AlterTable
ALTER TABLE "taxpayers" ADD COLUMN     "purchase_treatment" "PurchaseTreatment" NOT NULL DEFAULT 'CLAIM_CREDIT',
ADD COLUMN     "typical_expenses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "work_description" TEXT,
ADD COLUMN     "work_setup" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "supplier_profiles" (
    "supplier_ruc" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "kinds" TEXT[],
    "summary" TEXT NOT NULL,
    "mixed_use" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DECIMAL(3,2) NOT NULL,
    "model_id" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("supplier_ruc")
);

