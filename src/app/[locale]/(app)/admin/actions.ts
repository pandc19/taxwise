'use server';

import { revalidatePath } from 'next/cache';
import { asAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import type { TaxRateType } from '@prisma/client';

/**
 * System administration: the admin loads verified rates. They never see
 * taxpayer data -- everything here runs with `asAdmin()`, never `withUser()`.
 */

export async function getTaxRates() {
  await requireAdmin();
  return asAdmin((tx) => tx.taxRate.findMany({ orderBy: { validFrom: 'desc' } }));
}

export interface CreateTaxRateInput {
  tax: TaxRateType;
  rate: string;
  validFrom: string;
  validTo?: string;
  source: string;
  verifiedAt: string;
}

export interface CreateTaxRateResult {
  success: boolean;
  error?: 'ALREADY_EXISTS' | 'UNKNOWN';
}

/**
 * Never called with an unverified value -- the screen won't submit the
 * form without `source`/`verifiedAt` (CLAUDE.md -> "Normative values").
 * No data is seeded: no rate in docs/tax/vat-rates.md is verified yet.
 */
export async function createTaxRate(input: CreateTaxRateInput): Promise<CreateTaxRateResult> {
  const userId = await requireAdmin();

  try {
    await asAdmin((tx) =>
      tx.taxRate.create({
        data: {
          tax: input.tax,
          rate: input.rate,
          validFrom: new Date(input.validFrom),
          validTo: input.validTo ? new Date(input.validTo) : null,
          source: input.source,
          verifiedAt: new Date(input.verifiedAt),
          createdBy: userId,
        },
      })
    );
    revalidatePath('/admin/rates');
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { success: false, error: 'ALREADY_EXISTS' };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}

export interface DeleteResult {
  success: boolean;
  error?: 'UNKNOWN';
}

export async function deleteTaxRate(tax: TaxRateType, validFrom: string): Promise<DeleteResult> {
  await requireAdmin();
  try {
    await asAdmin((tx) =>
      tx.taxRate.delete({ where: { tax_validFrom: { tax, validFrom: new Date(validFrom) } } })
    );
  } catch {
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath('/admin/rates');
  return { success: true };
}

export interface UpdateResult {
  success: boolean;
  error?: 'UNKNOWN';
}

/** The `(tax, valid_from)` key is not editable; change it by delete + create. */
export async function updateTaxRate(
  tax: TaxRateType,
  validFrom: string,
  input: { rate: string; validTo?: string; source: string; verifiedAt: string }
): Promise<UpdateResult> {
  await requireAdmin();
  try {
    await asAdmin((tx) =>
      tx.taxRate.update({
        where: { tax_validFrom: { tax, validFrom: new Date(validFrom) } },
        data: {
          rate: input.rate,
          validTo: input.validTo ? new Date(input.validTo) : null,
          source: input.source,
          verifiedAt: new Date(input.verifiedAt),
        },
      })
    );
  } catch {
    return { success: false, error: 'UNKNOWN' };
  }
  revalidatePath('/admin/rates');
  return { success: true };
}
