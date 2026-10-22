-- ADR-016: results are no longer mapped to Form 104 fields. The form catalog
-- and the result mappings are dropped (they held no taxpayer data).

-- DropForeignKey
ALTER TABLE "form_fields" DROP CONSTRAINT "form_fields_form_version_id_fkey";

-- DropForeignKey
ALTER TABLE "form_versions" DROP CONSTRAINT "form_versions_imported_by_fkey";

-- DropForeignKey
ALTER TABLE "result_mappings" DROP CONSTRAINT "result_mappings_form_field_id_fkey";

-- DropForeignKey
ALTER TABLE "result_mappings" DROP CONSTRAINT "result_mappings_form_version_id_fkey";

-- DropForeignKey
ALTER TABLE "tax_periods" DROP CONSTRAINT "tax_periods_form_version_id_fkey";

-- AlterTable
ALTER TABLE "tax_periods" DROP COLUMN "form_version_id";

-- DropTable
DROP TABLE "form_fields";

-- DropTable
DROP TABLE "form_versions";

-- DropTable
DROP TABLE "result_mappings";

-- DropEnum
DROP TYPE "ColumnKind";

-- DropEnum
DROP TYPE "FormStatus";

-- DropEnum
DROP TYPE "MappingMethod";

