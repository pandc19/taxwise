-- ADR-018: AI is set up by each user (provider, encrypted key, workspace, model); the
-- server holds no AI key, so the per-account switch (ai_enabled) is gone: no key means no AI.
-- AlterTable
ALTER TABLE "users" DROP COLUMN "ai_enabled",
ADD COLUMN     "ai_key_encrypted" TEXT,
ADD COLUMN     "ai_key_hint" TEXT,
ADD COLUMN     "ai_model" TEXT,
ADD COLUMN     "ai_provider" TEXT,
ADD COLUMN     "ai_workspace_id" TEXT;

