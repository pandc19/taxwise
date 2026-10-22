/**
 * Classification cascade for received invoices (compras).
 * ADR-017 (replaces the order of ADR-005): the cascade decides whether a
 * supplier's purchases RELATE to the taxpayer's work; the category is then
 * derived from the taxpayer's own purchase-treatment setting. The AI never
 * chooses between credit and expense.
 *
 * Level 1: the user's own rule for the supplier
 * Level 2: an earlier AI answer, remembered for the same context
 * Level 3: the supplier's kind matches something the user buys for work
 * Level 4: AI relevance answer (optional)
 * Otherwise: manual review queue
 *
 * A supplier flagged mixed-use (sells the same thing to businesses and to
 * households) is only ever decided by a rule: its vouchers go to review. So
 * is a supplier the AI doesn't recognise (low profile confidence): judging
 * relevance from a guess would only launder the guess.
 *
 * Pure domain logic: no database, no I/O, no AI calls here.
 */

import Decimal from 'decimal.js';
import { IvaCategoryEnum } from '../types';
import { kindsCoveredBy } from './supplier-kinds';
import type { SupplierKind } from './supplier-kinds';

export type Relevance = 'RELATED' | 'NOT_RELATED';
export type PurchaseTreatment = 'CLAIM_CREDIT' | 'DEDUCT_AS_EXPENSE';

/** Minimum confidence to accept an AI relevance answer. */
export const AI_ACCEPTANCE_THRESHOLD = 0.8;

/** Below this, the AI doesn't really know who the supplier is. */
export const PROFILE_MIN_CONFIDENCE = 0.7;

/**
 * Category stored on a voucher, from its relevance and the taxpayer's own
 * choice of how to treat the IVA of purchases related to their work.
 */
export function categoryFor(relevance: Relevance, treatment: PurchaseTreatment): IvaCategoryEnum {
  if (relevance === 'NOT_RELATED') return IvaCategoryEnum.NON_DEDUCTIBLE;
  return treatment === 'CLAIM_CREDIT' ? IvaCategoryEnum.CREDIT : IvaCategoryEnum.COST_EXPENSE;
}

/**
 * Classification input: invoice metadata plus the taxpayer's context.
 */
export interface ClassificationInput {
  invoiceId: string;
  emitterRuc: string;
  emitterName: string;
  documentType: string;
  series: string;
  subtotal: Decimal;
  vat: Decimal;
  documentTypeRecognized: boolean; // From whitelist validation (ADR-010)
  activityFingerprint: string; // Hash of taxpayer's activities
  workProfileHash: string; // Hash of the taxpayer's work profile (ADR-017)
  typicalExpenses: string[]; // What the taxpayer says they buy for work
  purchaseTreatment: PurchaseTreatment;
}

/**
 * Classification decision with provenance.
 */
export interface ClassificationDecision {
  invoiceId: string;
  relevance: Relevance;
  category: IvaCategoryEnum;
  method: 'RULE' | 'REMEMBERED_AI' | 'PROFILE' | 'AI';
  confidence?: number; // 0.00-1.00, only for AI-derived decisions
  reason: string;
}

/**
 * Supplier rule: a decision about a supplier for one taxpayer. `USER` rules
 * are the user's explicit choice; `AI` rules are remembered answers, valid
 * only for the work profile they were given (`profileHash`).
 */
export interface SupplierRule {
  taxpayerId: string;
  emitterRuc: string;
  activityFingerprint: string;
  relevance: Relevance;
  source: 'USER' | 'AI' | 'CATALOG';
  profileHash: string | null;
  confidence?: number;
}

/** What is known about a supplier regardless of who buys from it. */
export interface SupplierFacts {
  kinds: SupplierKind[];
  mixedUse: boolean;
  /** How sure the profile is of what the supplier is (0-1). */
  confidence: number;
}

/** The supplier's profile is trustworthy enough to reason from. */
function isKnown(facts: SupplierFacts | null): boolean {
  return facts === null || facts.confidence >= PROFILE_MIN_CONFIDENCE;
}

export interface AiRelevanceDecision {
  relevance: Relevance | 'UNSURE';
  confidence: number;
}

/**
 * Classification cascade implementation.
 */
export class ClassificationCascade {
  /** Level 1: the user's own rule, issued under the current activities. */
  level1_userRule(input: ClassificationInput, rule: SupplierRule | null): ClassificationDecision | null {
    if (
      !rule ||
      rule.source !== 'USER' ||
      rule.emitterRuc !== input.emitterRuc ||
      rule.activityFingerprint !== input.activityFingerprint
    ) {
      return null;
    }

    return this.decide(input, rule.relevance, 'RULE', `Supplier rule: ${input.emitterName} (${input.emitterRuc}) set by the user as ${rule.relevance}`);
  }

  /** Level 2: an earlier AI answer for the same activities and work profile. */
  level2_rememberedAi(
    input: ClassificationInput,
    rule: SupplierRule | null,
    facts: SupplierFacts | null = null
  ): ClassificationDecision | null {
    if (
      !rule ||
      !isKnown(facts) ||
      rule.source !== 'AI' ||
      rule.emitterRuc !== input.emitterRuc ||
      rule.activityFingerprint !== input.activityFingerprint ||
      rule.profileHash !== input.workProfileHash
    ) {
      return null;
    }

    return this.decide(
      input,
      rule.relevance,
      'REMEMBERED_AI',
      `Remembered AI answer for ${input.emitterName}: ${rule.relevance}`,
      rule.confidence
    );
  }

  /**
   * Level 3: the supplier sells something the user said they buy for work.
   * Only ever concludes RELATED -- a supplier that doesn't match proves
   * nothing, so it falls through to the AI.
   */
  level3_profile(input: ClassificationInput, facts: SupplierFacts | null): ClassificationDecision | null {
    if (!facts || !isKnown(facts) || facts.mixedUse || !kindsCoveredBy(facts.kinds, input.typicalExpenses)) {
      return null;
    }

    return this.decide(
      input,
      'RELATED',
      'PROFILE',
      `${input.emitterName} sells ${facts.kinds.join(', ')}, which the taxpayer buys for work`
    );
  }

  /** Level 4: AI relevance answer. Requires confidence >= 0.80. */
  level4_ai(
    input: ClassificationInput,
    ai: AiRelevanceDecision | null,
    facts: SupplierFacts | null
  ): ClassificationDecision | null {
    if (
      !ai ||
      ai.relevance === 'UNSURE' ||
      ai.confidence < AI_ACCEPTANCE_THRESHOLD ||
      facts?.mixedUse ||
      !isKnown(facts)
    ) {
      return null;
    }

    return this.decide(
      input,
      ai.relevance,
      'AI',
      `AI suggestion (${(ai.confidence * 100).toFixed(0)}% confidence) for ${input.emitterName}: ${ai.relevance}`,
      ai.confidence
    );
  }

  /**
   * Run the full cascade.
   * Returns the first match, or null when the voucher goes to review.
   */
  classify(
    input: ClassificationInput,
    rule: SupplierRule | null,
    facts: SupplierFacts | null,
    ai: AiRelevanceDecision | null
  ): ClassificationDecision | null {
    return (
      this.level1_userRule(input, rule) ??
      this.level2_rememberedAi(input, rule, facts) ??
      this.level3_profile(input, facts) ??
      this.level4_ai(input, ai, facts)
    );
  }

  /**
   * Whether asking the AI could change the outcome: nothing before level 4
   * decided, and the supplier is neither mixed-use nor unknown to the AI.
   */
  needsAi(input: ClassificationInput, rule: SupplierRule | null, facts: SupplierFacts | null): boolean {
    return !facts?.mixedUse && isKnown(facts) && this.classify(input, rule, facts, null) === null;
  }

  private decide(
    input: ClassificationInput,
    relevance: Relevance,
    method: ClassificationDecision['method'],
    reason: string,
    confidence?: number
  ): ClassificationDecision {
    return {
      invoiceId: input.invoiceId,
      relevance,
      category: categoryFor(relevance, input.purchaseTreatment),
      method,
      confidence,
      reason,
    };
  }
}

export const classificationCascade = new ClassificationCascade();

/**
 * A voucher type outside the ingestion whitelist (ADR-010,
 * services/ingestion/ingestion-service.ts VOUCHER_TYPE_WHITELIST) is never
 * rejected outright, but it does need manual review instead of running
 * through the cascade — this is the single source of truth for
 * "recognized", not a second, narrower list.
 */
export function requiresManualReview(documentTypeRecognized: boolean): boolean {
  return !documentTypeRecognized;
}
