-- ADR-018: a separate model for identifying suppliers; ai_model now answers everything else.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ai_supplier_model" TEXT;

