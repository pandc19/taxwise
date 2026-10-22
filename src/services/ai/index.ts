import { ClaudeClassifier } from './providers/claude-classifier';
import { OpenAiClassifier } from './providers/openai-classifier';
import type { AiClassifier } from './types';

export { PROFILE_PROMPT_VERSION, RELEVANCE_PROMPT_VERSION } from './types';
export type {
  AiClassifier,
  SupplierProfileRequest,
  SupplierProfileResult,
  RelevanceRequest,
  RelevanceResult,
} from './types';

/**
 * Which engine runs the cascade's AI level (ADR-017), picked by
 * `AI_PROVIDER` instead of a code change -- `ClaudeClassifier` and
 * `OpenAiClassifier` both implement the same `AiClassifier` contract, so
 * swapping providers never touches the caller in conciliacion/actions.ts.
 *
 * Returns `null` when the selected provider has no API key configured:
 * that's ADR-007's "no-AI mode", not an error -- the cascade just falls
 * through to manual review for every supplier.
 */
export function getAiClassifier(): AiClassifier | null {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();

  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY ? new OpenAiClassifier() : null;
  }
  if (provider === 'claude') {
    return process.env.ANTHROPIC_API_KEY ? new ClaudeClassifier() : null;
  }

  throw new Error(`Unknown AI_PROVIDER "${provider}" -- expected "claude" or "openai"`);
}
