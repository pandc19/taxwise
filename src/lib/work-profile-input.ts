import { TYPICAL_EXPENSES, WORK_SETUPS } from '@/domain/iva';
import type { PurchaseTreatment } from '@prisma/client';

export const WORK_DESCRIPTION_MAX = 280;

export interface WorkProfileInput {
  workDescription?: string;
  workSetup: string[];
  typicalExpenses: string[];
  purchaseTreatment: PurchaseTreatment;
}

/**
 * What the form sends is not trusted: keep only known options and cap the
 * free text (ADR-017 -- it is sent to the AI, so it stays short).
 */
export function normalizeWorkProfile(input: WorkProfileInput) {
  return {
    workDescription: input.workDescription?.trim().slice(0, WORK_DESCRIPTION_MAX) || null,
    workSetup: WORK_SETUPS.filter((o) => input.workSetup.includes(o)),
    typicalExpenses: TYPICAL_EXPENSES.filter((o) => input.typicalExpenses.includes(o)),
    purchaseTreatment:
      input.purchaseTreatment === 'DEDUCT_AS_EXPENSE' ? ('DEDUCT_AS_EXPENSE' as const) : ('CLAIM_CREDIT' as const),
  };
}
