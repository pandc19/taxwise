'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import { canStoreSecrets, decryptSecret, encryptSecret } from '@/lib/secret-box';
import { keyHint, verifyAiSettings } from '@/services/ai';
import type { ProviderName } from '@/services/ai';

/** Short codes, not text: the form turns them into words. */
export type SaveAiError =
  | 'unavailable'
  | 'provider'
  | 'key'
  | 'workspace-format'
  | 'model-format'
  | 'rejected'
  | 'workspace'
  | 'workspace-invalid'
  | 'model'
  | 'unreachable';

export type SaveAiResult = { success: true } | { success: false; error: SaveAiError };

/** What Settings shows: never the key, only which provider and its last four characters. */
export async function getAiSettings() {
  const userId = await getCurrentUserId();
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      aiProvider: true,
      aiKeyEncrypted: true,
      aiKeyHint: true,
      aiWorkspaceId: true,
      aiModel: true,
      aiSupplierModel: true,
    },
  });
  return {
    canStore: canStoreSecrets(),
    saved: row.aiKeyEncrypted
      ? {
          provider: (row.aiProvider === 'openai' ? 'openai' : 'claude') as ProviderName,
          keyHint: row.aiKeyHint,
          workspaceId: row.aiWorkspaceId,
          model: row.aiModel,
          supplierModel: row.aiSupplierModel,
        }
      : null,
  };
}

/**
 * Saves the user's AI settings (ADR-018): provider, key, an Anthropic workspace id and two models (one for
 * identifying suppliers, one for everything else). They are
 * checked with the provider first (requests that cost nothing), then stored; the key encrypted. The key is
 * never returned and never logged. With the key left empty the saved one is kept and only the other settings
 * change.
 */
export async function saveAiSettings(input: {
  provider: string;
  key: string;
  workspaceId: string;
  model: string;
  supplierModel: string;
}): Promise<SaveAiResult> {
  const userId = await getCurrentUserId();
  if (!canStoreSecrets()) return { success: false, error: 'unavailable' };

  const provider = input.provider;
  if (provider !== 'claude' && provider !== 'openai') return { success: false, error: 'provider' };
  // A workspace only exists at Anthropic.
  const workspaceId = provider === 'claude' ? input.workspaceId.trim() : '';
  const model = input.model.trim();
  const supplierModel = input.supplierModel.trim();
  if (workspaceId && !/^[\w-]{3,100}$/.test(workspaceId)) return { success: false, error: 'workspace-format' };
  if ((model && !/^[\w.:/-]{2,100}$/.test(model)) || (supplierModel && !/^[\w.:/-]{2,100}$/.test(supplierModel))) {
    return { success: false, error: 'model-format' };
  }

  let key = input.key.trim();
  const typedKey = key !== '';
  if (typedKey) {
    if (key.length < 20 || key.length > 300 || /\s/.test(key)) return { success: false, error: 'key' };
  } else {
    // No new key: keep the saved one, which belongs to one provider and cannot move to another.
    const saved = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, aiKeyEncrypted: true },
    });
    const current =
      saved?.aiKeyEncrypted && saved.aiProvider === provider ? decryptSecret(saved.aiKeyEncrypted, userId) : null;
    if (!current) return { success: false, error: 'key' };
    key = current;
  }

  const check = await verifyAiSettings({ provider, key, workspaceId: workspaceId || null, models: [model, supplierModel] });
  if (check !== 'ok') return { success: false, error: check };

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiProvider: provider,
      ...(typedKey ? { aiKeyEncrypted: encryptSecret(key, userId), aiKeyHint: keyHint(key) } : {}),
      aiWorkspaceId: workspaceId || null,
      aiModel: model || null,
      aiSupplierModel: supplierModel || null,
    },
  });
  revalidatePath('/settings/ai');
  return { success: true };
}

export async function removeAiSettings(): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { aiProvider: null, aiKeyEncrypted: null, aiKeyHint: null, aiWorkspaceId: null, aiModel: null, aiSupplierModel: null },
  });
  revalidatePath('/settings/ai');
}
