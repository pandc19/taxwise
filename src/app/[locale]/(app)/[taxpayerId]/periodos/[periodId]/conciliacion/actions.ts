'use server';

import { revalidatePath } from 'next/cache';
import { prisma, withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import {
  classificationCascade,
  computeWorkProfileHash,
  PROFILE_MIN_CONFIDENCE,
  requiresManualReview,
} from '@/domain/iva';
import type {
  ClassificationInput,
  SupplierFacts,
  SupplierKind,
  SupplierRule,
} from '@/domain/iva';
import { VOUCHER_TYPE_WHITELIST } from '@/services/ingestion';
import { parseAccessKey } from '@/domain/iva/access-key';
import { getAiClassifier, PROFILE_PROMPT_VERSION, RELEVANCE_PROMPT_VERSION } from '@/services/ai';
import type { RelevanceResult } from '@/services/ai';
import type { IvaCategory, ProcessingStatus, ClassificationSourceType, Relevance } from '@prisma/client';

export async function getPurchasesByStatus(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx.invoiceReceived.findMany({
      where: { taxpayerId, taxPeriodId: periodId },
      orderBy: { issueDate: 'asc' },
    })
  );
}

/**
 * What is known about each supplier of the period (ADR-017), for the review
 * dialog: it explains why a voucher was decided by the user's profile, or
 * why a mixed-use supplier is waiting for the user.
 */
export async function getSupplierProfiles(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    const suppliers = await tx.invoiceReceived.findMany({
      where: { taxpayerId, taxPeriodId: periodId },
      select: { supplierRuc: true },
      distinct: ['supplierRuc'],
    });
    const profiles = await tx.supplierProfile.findMany({
      where: { supplierRuc: { in: suppliers.map((s) => s.supplierRuc) } },
    });
    return new Map(
      profiles.map((p) => [
        p.supplierRuc,
        { summary: p.summary, kinds: p.kinds, mixedUse: p.mixedUse, unknown: p.confidence.toNumber() < PROFILE_MIN_CONFIDENCE },
      ])
    );
  });
}

/**
 * The latest AI answer per voucher (confidence + the model's own
 * explanation), from the audit log, for the review dialog.
 */
export async function getAiNotes(taxpayerId: string, periodId: string) {
  const userId = await getCurrentUserId();
  const events = await withUser(userId, (tx) =>
    tx.classificationEvent.findMany({
      where: {
        taxpayerId,
        taxPeriodId: periodId,
        receivedInvoiceId: { not: null },
        actorType: 'ENGINE',
      },
      orderBy: { createdAt: 'desc' },
    })
  );
  const notes = new Map<string, { confidence: string; reasoning: string; modelId: string }>();
  const seen = new Set<string>();
  for (const e of events) {
    if (!e.receivedInvoiceId || seen.has(e.receivedInvoiceId)) continue;
    seen.add(e.receivedInvoiceId);
    // Only the engine's latest word counts: an earlier AI answer that a
    // later run withdrew (unknown or mixed-use supplier) no longer explains
    // the voucher.
    if (e.aiReasoning) {
      notes.set(e.receivedInvoiceId, {
        confidence: e.aiConfidence?.toString() ?? '',
        reasoning: e.aiReasoning ?? '',
        modelId: e.modelId ?? '',
      });
    }
  }
  return notes;
}

/**
 * Step 2 of ingestion (ADR-011): groups by supplier and runs the
 * four-level cascade (ADR-005). Resumable -- only touches what's still
 * unclassified.
 */
/** How many AI requests run at once (one per supplier). */
const AI_CONCURRENCY = 5;

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export interface ClassifyOptions {
  /** Re-run exactly these vouchers, whatever their current state. */
  invoiceIds?: string[];
  /** Re-run every voucher not decided by the user (engine results only). */
  reclassify?: boolean;
}

export interface ClassifyResult {
  /** Suppliers whose AI call failed; they are left for manual review. */
  aiFailures: number;
  aiError?: string;
}

export async function classifyPeriod(
  taxpayerId: string,
  periodId: string,
  options: ClassifyOptions = {}
): Promise<ClassifyResult> {
  const userId = await getCurrentUserId();
  const result: ClassifyResult = { aiFailures: 0 };

  // Three phases, so no AI call ever runs inside a DB transaction (Prisma's
  // interactive transactions expire after 5 s, and one AI call per
  // supplier easily exceeds that): read, ask the AI, write.

  // Phase 1 -- read.
  const { pending, taxpayer, rules, profiles, aiEnabled } = await withUser(userId, async (tx) => {
    // Default: only what is still open. REQUIRES_MANUAL_REVIEW is what an
    // earlier engine run left unresolved (a manual decision makes it
    // PROCESSED), so re-running may now resolve it -- e.g. once an AI key
    // is configured. `reclassify` also re-runs engine-classified vouchers
    // but never the user's own decisions; `invoiceIds` is an explicit
    // request and overrides both.
    const statusFilter = options.invoiceIds
      ? { id: { in: options.invoiceIds } }
      : options.reclassify
        ? { OR: [{ classificationSource: null }, { classificationSource: { not: 'USER' as const } }] }
        : { processingStatus: { in: ['UNCLASSIFIED', 'REQUIRES_MANUAL_REVIEW'] as ProcessingStatus[] } };

    const pending = await tx.invoiceReceived.findMany({
      where: {
        taxpayerId,
        taxPeriodId: periodId,
        vatAmount: { gt: 0 },
        ...statusFilter,
      },
    });
    const suppliers = [...new Set(pending.map((i) => i.supplierRuc))];
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } });
    const rules = await tx.supplierRule.findMany({
      where: { taxpayerId, revokedAt: null, supplierRuc: { in: suppliers } },
    });
    // Global table, no RLS: what each supplier is, whoever bought from it.
    const profiles = await tx.supplierProfile.findMany({ where: { supplierRuc: { in: suppliers } } });
    const { aiEnabled } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { aiEnabled: true },
    });
    return { pending, taxpayer, rules, profiles, aiEnabled };
  });

  // No-AI mode (ADR-007) is a per-account setting, and also what a missing
  // provider key means: either way the cascade falls through to review.
  const aiClassifier = aiEnabled ? getAiClassifier() : null;

  const bySupplier = new Map<string, typeof pending>();
  for (const invoice of pending) {
    const key = invoice.supplierRuc;
    if (!bySupplier.has(key)) bySupplier.set(key, []);
    bySupplier.get(key)!.push(invoice);
  }
  const ruleBySupplier = new Map(rules.map((r) => [r.supplierRuc, r]));
  const factsBySupplier = new Map<string, SupplierFacts>(
    profiles.map((p) => [
      p.supplierRuc,
      { kinds: p.kinds as SupplierKind[], mixedUse: p.mixedUse, confidence: p.confidence.toNumber() },
    ])
  );
  // A profile written by an older prompt is asked again (ADR-017) -- unless
  // the AI is off, in which case the old one is better than nothing.
  const outdatedProfiles = new Set(
    profiles.filter((p) => p.promptVersion !== PROFILE_PROMPT_VERSION).map((p) => p.supplierRuc)
  );
  // A remembered AI answer is valid for the work profile AND the prompt that
  // produced it: a new prompt version makes them all be asked again.
  const workProfileHash = `${computeWorkProfileHash({
    workDescription: taxpayer.workDescription,
    workSetup: taxpayer.workSetup,
    typicalExpenses: taxpayer.typicalExpenses,
  })}:${RELEVANCE_PROMPT_VERSION}`;
  const buyerActivities = taxpayer.economicActivities as Array<{ code: string; description: string }>;

  function toDomainRule(rule: (typeof rules)[number] | undefined): SupplierRule | null {
    return rule
      ? {
          taxpayerId,
          emitterRuc: rule.supplierRuc,
          activityFingerprint: rule.activityFingerprint,
          relevance: rule.relevance,
          source: rule.source,
          profileHash: rule.profileHash,
          confidence: rule.confidence?.toNumber(),
        }
      : null;
  }

  // ADR-010: a single unrecognized type in the group sends the whole
  // supplier to manual review, without going through the cascade.
  // The allowlist is keyed on SRI type codes; the stored `documentType`
  // is the file's name ("Factura"), so use the code embedded in the
  // access key.
  const needsReviewBySupplier = new Map<string, boolean>();
  const allRecognizedBySupplier = new Map<string, boolean>();
  for (const [supplierRuc, invoices] of bySupplier) {
    const allRecognized = invoices.every((inv) => {
      try {
        return VOUCHER_TYPE_WHITELIST.has(parseAccessKey(inv.accessKey).documentType);
      } catch {
        return false;
      }
    });
    allRecognizedBySupplier.set(supplierRuc, allRecognized);
    needsReviewBySupplier.set(supplierRuc, requiresManualReview(allRecognized));
  }

  function inputFor(supplierRuc: string): ClassificationInput {
    const representative = bySupplier.get(supplierRuc)![0];
    return {
      invoiceId: representative.id,
      emitterRuc: supplierRuc,
      emitterName: representative.supplierName,
      documentType: representative.documentType,
      series: representative.series,
      subtotal: representative.subtotal,
      vat: representative.vatAmount,
      documentTypeRecognized: allRecognizedBySupplier.get(supplierRuc)!,
      activityFingerprint: taxpayer.activityFingerprint,
      workProfileHash,
      typicalExpenses: taxpayer.typicalExpenses,
      purchaseTreatment: taxpayer.purchaseTreatment,
    };
  }

  // Phase 2 -- ask the AI, outside any transaction, and only when no earlier
  // level would decide (a rule, a remembered answer, or the supplier's kind
  // matching what the user buys for work): anything else is unused cost.
  // First what the supplier is (once per RUC, stored globally), then whether
  // it relates to this taxpayer's work. ADR-007: the first call carries only
  // the supplier's identity, the second only its stored profile plus the
  // buyer's activities and work profile -- never the buyer's RUC or name.
  const relevanceBySupplier = new Map<string, RelevanceResult>();
  const profileSummaries = new Map<string, string>();
  if (aiClassifier) {
    const candidates = [...bySupplier.keys()].filter((ruc) => !needsReviewBySupplier.get(ruc));
    await mapWithConcurrency(candidates, AI_CONCURRENCY, async (supplierRuc) => {
      const input = inputFor(supplierRuc);
      const rule = toDomainRule(ruleBySupplier.get(supplierRuc));
      try {
        // The user's own rule decides it: nothing to ask.
        if (classificationCascade.level1_userRule(input, rule)) return;

        // What the supplier is comes first -- also to refresh a profile an
        // older prompt wrote, which can overturn a remembered answer.
        let facts = factsBySupplier.get(supplierRuc);
        if (!facts || outdatedProfiles.has(supplierRuc)) {
          const profile = await aiClassifier.profileSupplier({
            supplierRuc,
            supplierName: input.emitterName,
          });
          if (!profile) return;
          await prisma.supplierProfile.upsert({
            where: { supplierRuc },
            create: {
              supplierRuc,
              supplierName: input.emitterName,
              kinds: profile.kinds,
              summary: profile.summary,
              mixedUse: profile.mixedUse,
              confidence: profile.confidence,
              modelId: profile.modelId,
              promptVersion: profile.promptVersion,
            },
            update: {
              supplierName: input.emitterName,
              kinds: profile.kinds,
              summary: profile.summary,
              mixedUse: profile.mixedUse,
              confidence: profile.confidence,
              modelId: profile.modelId,
              promptVersion: profile.promptVersion,
            },
          });
          facts = { kinds: profile.kinds, mixedUse: profile.mixedUse, confidence: profile.confidence };
          factsBySupplier.set(supplierRuc, facts);
          profileSummaries.set(supplierRuc, profile.summary);
        }

        // A remembered answer, the supplier's kind, or an unknown or
        // mixed-use supplier may already settle it.
        if (!classificationCascade.needsAi(input, rule, facts)) return;

        const relevance = await aiClassifier.judgeRelevance({
          supplierKinds: facts.kinds,
          supplierSummary:
            profileSummaries.get(supplierRuc) ?? profiles.find((p) => p.supplierRuc === supplierRuc)?.summary ?? '',
          buyerActivities,
          buyerRegime: taxpayer.regime,
          workDescription: taxpayer.workDescription,
          workSetup: taxpayer.workSetup,
          typicalExpenses: taxpayer.typicalExpenses,
        });
        if (relevance) relevanceBySupplier.set(supplierRuc, relevance);
      } catch (err) {
        // A provider/config failure must not abort the whole run: the
        // supplier falls through to manual review and the failure is
        // reported to the screen.
        result.aiFailures += 1;
        result.aiError ??= err instanceof Error ? err.message : String(err);
      }
    });
  }

  // Phase 3 -- decide and write, in one short transaction.
  await withUser(userId, async (tx) => {
    for (const [supplierRuc, invoices] of bySupplier) {
      const needsReview = needsReviewBySupplier.get(supplierRuc)!;
      const facts = factsBySupplier.get(supplierRuc) ?? null;
      let existingRule = ruleBySupplier.get(supplierRuc);
      const relevance = relevanceBySupplier.get(supplierRuc) ?? null;

      // A remembered AI answer that rested on a profile now known to be a
      // guess no longer stands.
      if (existingRule?.source === 'AI' && facts && facts.confidence < PROFILE_MIN_CONFIDENCE) {
        await tx.supplierRule.update({ where: { id: existingRule.id }, data: { revokedAt: new Date() } });
        existingRule = undefined;
      }

      const decision = needsReview
        ? null
        : classificationCascade.classify(
            inputFor(supplierRuc),
            toDomainRule(existingRule),
            facts,
            relevance
          );

      const newStatus: ProcessingStatus = decision ? 'PROCESSED' : 'REQUIRES_MANUAL_REVIEW';
      const newCategory: IvaCategory = decision?.category ?? 'UNCLASSIFIED';
      const source: ClassificationSourceType | undefined = decision
        ? decision.method === 'RULE'
          ? 'RULE'
          : decision.method === 'PROFILE'
            ? 'DETERMINISTIC'
            : 'AI' // a fresh or a remembered AI answer
        : undefined;

      // What the event records about the AI: the answer just obtained, or --
      // for a remembered answer -- the one stored on the rule, so the
      // Conciliación detail dialog can still explain the decision.
      const remembered = decision?.method === 'REMEMBERED_AI' ? existingRule : undefined;
      const aiInfo = relevance
        ? {
            modelId: relevance.modelId,
            promptVersion: relevance.promptVersion,
            aiConfidence: relevance.confidence,
            aiReasoning: relevance.reasoning,
          }
        : remembered
          ? {
              modelId: remembered.modelId ?? undefined,
              promptVersion: remembered.promptVersion ?? undefined,
              aiConfidence: remembered.confidence ?? undefined,
              aiReasoning: remembered.reasoning ?? undefined,
            }
          : {};

      // Remember an accepted AI answer, so the same supplier is decided the
      // same way next period (ADR-005's consistency goal). Never over a
      // user's own rule, stale or not.
      if (decision?.method === 'AI' && relevance && relevance.relevance !== 'UNSURE') {
        const data = {
          activityFingerprint: taxpayer.activityFingerprint,
          relevance: relevance.relevance,
          profileHash: workProfileHash,
          confidence: relevance.confidence,
          reasoning: relevance.reasoning,
          modelId: relevance.modelId,
          promptVersion: relevance.promptVersion,
        };
        if (!existingRule) {
          await tx.supplierRule.create({ data: { taxpayerId, supplierRuc, source: 'AI', ...data } });
        } else if (existingRule.source === 'AI') {
          await tx.supplierRule.update({ where: { id: existingRule.id }, data });
        }
      } else if (existingRule?.source === 'AI' && relevance) {
        // Asked again (new prompt or work profile) and the new answer isn't
        // good enough: the old remembered answer must not linger as if it
        // still held.
        await tx.supplierRule.update({ where: { id: existingRule.id }, data: { revokedAt: new Date() } });
      }

      // A re-run that can't decide must not wipe an existing result --
      // unless the AI did answer and was unsure, or the supplier is now
      // known to need the user (mixed-use, or one the AI doesn't recognise):
      // then the old engine result is the weaker evidence and the voucher
      // goes back to review. When the AI wasn't consulted or failed (no key,
      // provider error), nothing new is known, so the result stays.
      const needsUser = !decision && !!facts && (facts.mixedUse || facts.confidence < PROFILE_MIN_CONFIDENCE);
      const targets =
        decision || relevance || needsUser
          ? invoices
          : invoices.filter((i) => i.processingStatus !== 'PROCESSED');
      if (targets.length === 0) continue;

      await tx.invoiceReceived.updateMany({
        where: { id: { in: targets.map((i) => i.id) } },
        data: {
          ivaCategory: newCategory,
          processingStatus: newStatus,
          classificationSource: source ?? null,
        },
      });
      await tx.classificationEvent.createMany({
        data: targets.map((invoice) => ({
          receivedInvoiceId: invoice.id,
          taxpayerId,
          taxPeriodId: periodId,
          field: 'ivaCategory',
          oldValue: invoice.ivaCategory,
          newValue: newCategory,
          actorType: 'ENGINE' as const,
          reason:
            decision?.reason ??
            (facts?.mixedUse
              ? 'Mixed-use supplier: the same goods serve businesses and households, so it needs the user\'s decision'
              : facts && facts.confidence < PROFILE_MIN_CONFIDENCE
                ? `The AI does not recognise this supplier (confidence ${facts.confidence}), so it needs the user\'s decision`
                : 'No match at any level of the cascade'),
          // CLAUDE.md -> "AI models": every AI response logs which model
          // and prompt version produced it. Recorded whenever the model
          // was consulted, including answers below the acceptance bar
          // (they explain why the voucher went to manual review).
          ...aiInfo,
        })),
      });
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/conciliacion`);
  return result;
}

/**
 * Manual classification (single or bulk). It decides only the selected
 * vouchers (ADR-017): a supplier often sells both business and personal
 * things, so one decision must not silently classify the rest. A rule for
 * the supplier is created or updated only when `applyToSupplier` is set.
 * Classifying a voucher differently from the user's own rule for the
 * supplier shows the supplier is mixed-use, so that rule is revoked (a
 * remembered AI answer is left alone: it can be changed on the Proveedores
 * screen).
 */
export async function applyManualClassification(
  invoiceIds: string[],
  category: IvaCategory,
  taxpayerId: string,
  periodId: string,
  options: { applyToSupplier?: boolean } = {}
) {
  const userId = await getCurrentUserId();

  await withUser(userId, async (tx) => {
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({ where: { id: taxpayerId } });

    for (const id of invoiceIds) {
      const invoice = await tx.invoiceReceived.findUniqueOrThrow({ where: { id } });

      await tx.invoiceReceived.update({
        where: { id },
        data: {
          ivaCategory: category,
          processingStatus: 'PROCESSED',
          classificationSource: 'USER',
        },
      });

      // Revocable rule, unique per (taxpayer, supplier) while not revoked
      // (ADR-006) -- not a composite key the schema can declare, so it's
      // looked up first instead of an upsert by PK.
      const existingRule = await tx.supplierRule.findFirst({
        where: { taxpayerId, supplierRuc: invoice.supplierRuc, revokedAt: null },
      });

      // A rule says whether the supplier relates to the user's work; the
      // category itself still follows the taxpayer's purchase treatment.
      const relevance: Relevance = category === 'NON_DEDUCTIBLE' ? 'NOT_RELATED' : 'RELATED';

      let reason = 'Manual: user';
      if (options.applyToSupplier) {
        if (existingRule) {
          await tx.supplierRule.update({
            where: { id: existingRule.id },
            data: {
              relevance,
              activityFingerprint: taxpayer.activityFingerprint,
              source: 'USER',
              profileHash: null,
              confidence: null,
              reasoning: null,
              modelId: null,
              promptVersion: null,
              timesApplied: { increment: 1 },
            },
          });
        } else {
          await tx.supplierRule.create({
            data: {
              taxpayerId,
              supplierRuc: invoice.supplierRuc,
              activityFingerprint: taxpayer.activityFingerprint,
              relevance,
              source: 'USER',
              createdBy: userId,
            },
          });
        }
        reason = 'Manual: user, applied to the supplier';
      } else if (existingRule && existingRule.source === 'USER' && existingRule.relevance !== relevance) {
        await tx.supplierRule.update({
          where: { id: existingRule.id },
          data: { revokedAt: new Date() },
        });
        reason = 'Manual: user; supplier rule revoked (mixed use)';
      }

      await tx.classificationEvent.create({
        data: {
          receivedInvoiceId: id,
          taxpayerId,
          taxPeriodId: periodId,
          field: 'ivaCategory',
          oldValue: invoice.ivaCategory,
          newValue: category,
          actorType: 'USER',
          actorUserId: userId,
          reason,
        },
      });
    }
  });

  revalidatePath(`/${taxpayerId}/periodos/${periodId}/conciliacion`);
}
