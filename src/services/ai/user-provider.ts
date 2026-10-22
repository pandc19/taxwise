import { prisma } from '@/lib/db';
import { decryptSecret } from '@/lib/secret-box';
import { ClaudeClassifier } from './providers/claude-classifier';
import { OpenAiClassifier } from './providers/openai-classifier';
import type { AiClassifier } from './types';

/**
 * The AI a user has: the provider, key, workspace and model they set up in Settings, and nothing else. The
 * server holds no AI key and reads no AI setting from the environment, so there is no AI for anyone who has
 * not set it up -- the no-AI mode of ADR-007 -- and what is asked is always paid by whoever asked
 * (ADR-018). `users` has no RLS, so this reads it directly.
 */
export async function getAiClassifierFor(userId: string): Promise<AiClassifier | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiProvider: true, aiKeyEncrypted: true, aiWorkspaceId: true, aiModel: true, aiSupplierModel: true },
  });
  // A key that cannot be read (the server's secret changed) counts as no key.
  const apiKey = row?.aiKeyEncrypted ? decryptSecret(row.aiKeyEncrypted, userId) : null;
  if (!row || !apiKey) return null;
  return row.aiProvider === 'openai'
    ? new OpenAiClassifier({ apiKey, model: row.aiModel, supplierModel: row.aiSupplierModel })
    : new ClaudeClassifier({
        apiKey,
        workspaceId: row.aiWorkspaceId,
        model: row.aiModel,
        supplierModel: row.aiSupplierModel,
      });
}
