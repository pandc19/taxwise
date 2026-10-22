import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ProviderName } from './models';

/**
 * `workspace`: Anthropic wants a workspace id with this key and none was given. `workspace-invalid`: it did not
 * accept the one given. `model`: the provider has no such model.
 */
export type KeyCheck = 'ok' | 'rejected' | 'workspace' | 'workspace-invalid' | 'model' | 'unreachable';

/**
 * Asks the provider things it answers for free (the list of models, and each chosen model by name) to see
 * whether the settings work, so a typo is caught when they are saved and not at the first classification.
 * Nothing is generated and nothing is charged.
 */
export async function verifyAiSettings(input: {
  provider: ProviderName;
  key: string;
  workspaceId?: string | null;
  /** Every model the user typed; each is looked up by name. */
  models?: Array<string | null | undefined>;
}): Promise<KeyCheck> {
  const { provider, key, workspaceId } = input;
  const models = (input.models ?? []).filter((m): m is string => Boolean(m));
  const options = { apiKey: key, maxRetries: 0, timeout: 10_000 };
  try {
    if (provider === 'claude') {
      const client = new Anthropic({
        ...options,
        ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
      });
      await client.models.list({ limit: 1 });
      for (const model of models) await client.models.retrieve(model);
    } else {
      const client = new OpenAI(options);
      await client.models.list();
      for (const model of models) await client.models.retrieve(model);
    }
    return 'ok';
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return 'rejected';
    if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) return 'rejected';
    if (error instanceof Anthropic.NotFoundError || error instanceof OpenAI.NotFoundError) return 'model';
    if (error instanceof Anthropic.BadRequestError && error.message.includes('anthropic-workspace-id')) {
      return workspaceId ? 'workspace-invalid' : 'workspace';
    }
    return 'unreachable';
  }
}

/** The last four characters, to show which key is saved without showing the key. */
export const keyHint = (key: string) => key.slice(-4);
