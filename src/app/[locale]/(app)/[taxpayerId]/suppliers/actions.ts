'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import type { Relevance } from '@prisma/client';

/**
 * The taxpayer's supplier rules (ADR-006, ADR-017): the only place to see,
 * change or revoke them. Revoking a rule never touches vouchers that were
 * already classified by it.
 */
export async function getSupplierRules(taxpayerId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({
      where: { id: taxpayerId },
      select: { activityFingerprint: true },
    });
    const rules = await tx.supplierRule.findMany({
      where: { taxpayerId, revokedAt: null },
      orderBy: { appliedAt: 'desc' },
    });
    const names = await tx.invoiceReceived.findMany({
      where: { taxpayerId, supplierRuc: { in: rules.map((r) => r.supplierRuc) } },
      select: { supplierRuc: true, supplierName: true },
      distinct: ['supplierRuc'],
    });
    const nameByRuc = new Map(names.map((n) => [n.supplierRuc, n.supplierName]));
    const profiles = await tx.supplierProfile.findMany({
      where: { supplierRuc: { in: rules.map((r) => r.supplierRuc) } },
    });
    const summaryByRuc = new Map(profiles.map((p) => [p.supplierRuc, p.summary]));
    return rules.map((r) => ({
      id: r.id,
      supplierRuc: r.supplierRuc,
      supplierName: nameByRuc.get(r.supplierRuc) ?? r.supplierRuc,
      relevance: r.relevance,
      source: r.source,
      summary: summaryByRuc.get(r.supplierRuc) ?? null,
      reasoning: r.reasoning,
      confidence: r.confidence?.toString() ?? null,
      // Only the user's own rules wait for reconfirmation; a remembered AI
      // answer that no longer fits is simply asked again.
      stale: r.source === 'USER' && r.activityFingerprint !== taxpayer.activityFingerprint,
    }));
  });
}

export async function revokeSupplierRule(taxpayerId: string, ruleId: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) =>
    tx.supplierRule.updateMany({
      where: { id: ruleId, taxpayerId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  );
  revalidatePath(`/${taxpayerId}/suppliers`);
}

/** Changing a rule also re-issues it under the current activity fingerprint. */
export async function changeSupplierRule(taxpayerId: string, ruleId: string, relevance: Relevance) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({
      where: { id: taxpayerId },
      select: { activityFingerprint: true },
    });
    await tx.supplierRule.updateMany({
      where: { id: ruleId, taxpayerId, revokedAt: null },
      data: {
        relevance,
        activityFingerprint: taxpayer.activityFingerprint,
        source: 'USER',
        profileHash: null,
        confidence: null,
        reasoning: null,
        modelId: null,
        promptVersion: null,
      },
    });
  });
  revalidatePath(`/${taxpayerId}/suppliers`);
}

/** Bulk reconfirmation of rules issued under an older activity fingerprint. */
export async function reconfirmStaleRules(taxpayerId: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({
      where: { id: taxpayerId },
      select: { activityFingerprint: true },
    });
    await tx.supplierRule.updateMany({
      where: {
        taxpayerId,
        revokedAt: null,
        source: 'USER',
        activityFingerprint: { not: taxpayer.activityFingerprint },
      },
      data: { activityFingerprint: taxpayer.activityFingerprint },
    });
  });
  revalidatePath(`/${taxpayerId}/suppliers`);
}
