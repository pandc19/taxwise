/**
 * Which model answers what. Nothing is read from the environment: a user sets their models in Settings
 * (ADR-018), and what they leave empty falls back to the provider's default below.
 *
 * Two kinds of work:
 *  - Normal AI work (today, whether a supplier relates to a taxpayer's work) has two tiers: a cheap "bulk"
 *    model answers first, and a stronger "deep" one can answer again when the bulk answer is not confident
 *    enough. In Settings the user picks ONE model, which is set for both tiers; with none chosen each
 *    provider uses its own pair.
 *  - Identifying a supplier (world knowledge, asked once per RUC and shared by every taxpayer) has its own
 *    model, which defaults to the strong one -- the small one confused a steel supplier with a computer shop.
 */
export type ProviderName = 'claude' | 'openai';
export type ModelTier = 'bulk' | 'deep';

/**
 * Whether a low-confidence bulk answer is asked again on the deep model. The logic is in the providers and
 * works; it is switched off for now (ADR-018), so the system never searches deeper. To enable it later, set
 * this to true -- or move it to a user setting -- and give users a way to choose a deep model.
 */
export const DEEP_RETRY_ENABLED = false;

export const DEFAULT_MODELS: Record<ProviderName, Record<ModelTier, string>> = {
  claude: { bulk: 'claude-haiku-5-5', deep: 'claude-opus-5-5' },
  openai: { bulk: 'gpt-4o-mini', deep: 'gpt-4o' },
};

/** Models Settings suggests while typing; any model the provider offers can be typed instead. */
export const SUGGESTED_MODELS: Record<ProviderName, string[]> = {
  claude: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
};

/**
 * The models to use: for normal work the one the user chose fills BOTH tiers, or else the provider's pair;
 * for identifying suppliers, the user's supplier model, or else the provider's strong one.
 */
export function modelsFor(
  provider: ProviderName,
  chosen: { model?: string | null; supplierModel?: string | null } = {}
): Record<ModelTier, string> & { supplier: string } {
  const model = chosen.model?.trim();
  const defaults = DEFAULT_MODELS[provider];
  return {
    bulk: model || defaults.bulk,
    deep: model || defaults.deep,
    supplier: chosen.supplierModel?.trim() || defaults.deep,
  };
}
