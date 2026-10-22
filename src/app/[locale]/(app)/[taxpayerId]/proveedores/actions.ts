'use server';

import { revalidatePath } from 'next/cache';
import { withUser } from '@/lib/db';
import { getCurrentUserId } from '@/lib/session';
import type { IvaCategory } from '@prisma/client';

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
    return rules.map((r) => ({
      id: r.id,
      supplierRuc: r.supplierRuc,
      supplierName: nameByRuc.get(r.supplierRuc) ?? r.supplierRuc,
      ivaCategory: r.ivaCategory,
      source: r.source,
      timesApplied: r.timesApplied,
      stale: r.activityFingerprint !== taxpayer.activityFingerprint,
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
  revalidatePath(`/${taxpayerId}/proveedores`);
}

/** Changing a rule also re-issues it under the current activity fingerprint. */
export async function changeSupplierRule(taxpayerId: string, ruleId: string, category: IvaCategory) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const taxpayer = await tx.taxpayer.findUniqueOrThrow({
      where: { id: taxpayerId },
      select: { activityFingerprint: true },
    });
    await tx.supplierRule.updateMany({
      where: { id: ruleId, taxpayerId, revokedAt: null },
      data: { ivaCategory: category, activityFingerprint: taxpayer.activityFingerprint, source: 'USER' },
    });
  });
  revalidatePath(`/${taxpayerId}/proveedores`);
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
      where: { taxpayerId, revokedAt: null, activityFingerprint: { not: taxpayer.activityFingerprint } },
      data: { activityFingerprint: taxpayer.activityFingerprint },
    });
  });
  revalidatePath(`/${taxpayerId}/proveedores`);
}
