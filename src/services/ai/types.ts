/**
 * Provider-agnostic AI interface (ADR-017, ADR-005 level 4, ADR-007).
 * Every provider implementation (Claude, OpenAI, ...) returns these same
 * shapes, so `getAiClassifier()`'s caller never knows which one answered.
 *
 * Two separate questions, asked at two different times:
 *  1. `profileSupplier` -- what is this supplier? Public data only (RUC and
 *     name), no buyer information at all; answered once per RUC and stored
 *     globally.
 *  2. `judgeRelevance` -- do purchases from this supplier relate to this
 *     buyer's work? Carries the supplier's stored profile and the buyer's
 *     activities and work profile, never the buyer's RUC or name (ADR-007).
 * Neither says anything about IVA credit: that follows from the taxpayer's
 * own setting, in the domain.
 */

import { SUPPLIER_KINDS } from '@/domain/iva';
import type { SupplierKind } from '@/domain/iva';

export interface SupplierProfileRequest {
  supplierRuc: string;
  supplierName: string;
}

export interface SupplierProfileResult {
  kinds: SupplierKind[];
  summary: string;
  mixedUse: boolean;
  confidence: number; // 0-1
  modelId: string;
  promptVersion: string;
}

export interface RelevanceRequest {
  supplierKinds: SupplierKind[];
  supplierSummary: string;
  /** The buyer's registered activities -- never the buyer's RUC or name. */
  buyerActivities: Array<{ code: string; description: string }>;
  buyerRegime: string;
  workDescription: string | null;
  workSetup: string[];
  typicalExpenses: string[];
}

export type AiRelevance = 'RELATED' | 'NOT_RELATED' | 'UNSURE';

export interface RelevanceResult {
  relevance: AiRelevance;
  confidence: number; // 0-1
  reasoning: string;
  modelId: string;
  promptVersion: string;
}

export interface AiClassifier {
  profileSupplier(request: SupplierProfileRequest): Promise<SupplierProfileResult | null>;
  judgeRelevance(request: RelevanceRequest): Promise<RelevanceResult | null>;
}

/**
 * Bumped whenever a prompt's wording or schema changes, so a stored row says
 * which prompt produced it (CLAUDE.md -> "Every response logs model_id and
 * prompt_version"). A new profile prompt version makes stored supplier
 * profiles eligible for refresh.
 */
// v3: same wording as v2, but profiles are now asked of the strong model
// (profiles written by the small model misidentified suppliers).
export const PROFILE_PROMPT_VERSION = 'supplier-profile-v3';
// v2: the prompt listed every possible option next to the buyer's own choices,
// so a model read unselected options (e.g. bank fees) as things the buyer said.
export const RELEVANCE_PROMPT_VERSION = 'relevance-v2';

export function buildProfilePrompt(request: SupplierProfileRequest): string {
  return `You are identifying a supplier that issues invoices in Ecuador, from its RUC and registered name only. You know nothing about who buys from it.

Supplier RUC: ${request.supplierRuc}
Supplier name: ${request.supplierName}

Describe what this supplier usually sells:
- kinds: one or more of ${SUPPLIER_KINDS.join(', ')}. Use OTHER only if nothing fits. Internet and phone/mobile providers (Netlife/Megadatos, Claro, Movistar/Otecel, CNT) are TELECOM_INTERNET; pay-TV and cinemas are ENTERTAINMENT_MEDIA; banks, card and payment platforms are BANKING_PAYMENTS.
- summary: one or two sentences on what it usually sells.
- mixedUse: be strict. true ONLY when the very same goods are routinely bought as inputs by many kinds of businesses AND by households, so the supplier alone cannot tell the purpose: hardware and building-materials stores, general retail and department stores, fuel stations. false for everything else, including suppliers a household uses more than a business (supermarkets, restaurants, pharmacies, pay-TV, cinemas, tourism) and services with a clear purpose (internet and phone providers, banks and payment platforms, software, transport, utilities, professional services). Being sold to both businesses and consumers is NOT enough -- almost every supplier is.
- confidence: 0 to 1 -- how sure you are of what this supplier is. If you don't recognise the name, answer low.`;
}

export function buildRelevancePrompt(request: RelevanceRequest): string {
  const activities =
    request.buyerActivities.length > 0
      ? request.buyerActivities.map((a) => `- ${a.code}: ${a.description}`).join('\n')
      : '- (none registered)';
  const list = (items: string[]) => (items.length > 0 ? items.join(', ') : '(not specified)');

  return `You are judging whether purchases from a supplier relate to the work of an Ecuadorian taxpayer. The buyer is identified only by what follows.

Buyer's economic activities:
${activities}
Buyer's tax regime: ${request.buyerRegime}
What the buyer says they do: ${request.workDescription?.trim() || '(not specified)'}
How the buyer works: ${list(request.workSetup)}
What the buyer says they typically buy for work: ${list(request.typicalExpenses)}
(Only what is listed above was stated by the buyer. Do not assume anything they did not list.)

Supplier kinds: ${request.supplierKinds.join(', ')}
What the supplier usually sells: ${request.supplierSummary}

Answer with:
- RELATED: what this supplier typically sells plausibly serves the buyer's work.
- NOT_RELATED: it does not (for example groceries, restaurants, entertainment or pharmacies for a buyer whose work doesn't need them).
- UNSURE: genuinely ambiguous.

You only know the supplier in general, not what was bought, so when the purpose is genuinely ambiguous answer UNSURE or a low confidence rather than guessing. Judge the fit with the buyer's own description of their work; being an ordinary company is not enough for RELATED. Do not decide anything about tax credit.`;
}
