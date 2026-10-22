/**
 * Closed vocabularies for supplier knowledge and the taxpayer's work
 * profile (ADR-017). Pure data: the AI layer shapes its structured output
 * from these lists, and the deterministic level of the cascade matches one
 * against the other -- no AI call needed when a supplier's kind is exactly
 * something the user said they buy for work.
 */

export const SUPPLIER_KINDS = [
  'TELECOM_INTERNET',
  'BANKING_PAYMENTS',
  'SOFTWARE_SUBSCRIPTIONS',
  'COMPUTERS_ELECTRONICS',
  'OFFICE_SUPPLIES',
  'HARDWARE_CONSTRUCTION',
  'TRANSPORT',
  'FUEL',
  'UTILITIES',
  'REAL_ESTATE_RENT',
  'PROFESSIONAL_SERVICES',
  'SUPERMARKET_GROCERY',
  'RESTAURANT_FOOD',
  'ENTERTAINMENT_MEDIA',
  'HEALTH_PHARMACY',
  'RETAIL_GENERAL',
  'OTHER',
] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];

export const WORK_SETUPS = [
  'REMOTE_HOME_OFFICE',
  'OWN_PREMISES',
  'FIELD_WORK',
  'OWN_EQUIPMENT',
] as const;
export type WorkSetup = (typeof WORK_SETUPS)[number];

export const TYPICAL_EXPENSES = [
  'INTERNET',
  'MOBILE',
  'HARDWARE_EQUIPMENT',
  'MAINTENANCE_TOOLS',
  'OFFICE_SUPPLIES',
  'SOFTWARE_SUBSCRIPTIONS',
  'BANK_PAYMENT_FEES',
  'TRANSPORT',
  'RENT',
  'UTILITIES',
  'PROFESSIONAL_SERVICES',
] as const;
export type TypicalExpense = (typeof TYPICAL_EXPENSES)[number];

/** Which "what I typically buy for work" items a supplier kind covers. */
const EXPENSES_FOR_KIND: Partial<Record<SupplierKind, readonly TypicalExpense[]>> = {
  TELECOM_INTERNET: ['INTERNET', 'MOBILE'],
  BANKING_PAYMENTS: ['BANK_PAYMENT_FEES'],
  SOFTWARE_SUBSCRIPTIONS: ['SOFTWARE_SUBSCRIPTIONS'],
  COMPUTERS_ELECTRONICS: ['HARDWARE_EQUIPMENT'],
  OFFICE_SUPPLIES: ['OFFICE_SUPPLIES'],
  HARDWARE_CONSTRUCTION: ['MAINTENANCE_TOOLS'],
  TRANSPORT: ['TRANSPORT'],
  UTILITIES: ['UTILITIES'],
  REAL_ESTATE_RENT: ['RENT'],
  PROFESSIONAL_SERVICES: ['PROFESSIONAL_SERVICES'],
};

/** True when one of the supplier's kinds is something the user buys for work. */
export function kindsCoveredBy(kinds: readonly SupplierKind[], typicalExpenses: readonly string[]): boolean {
  return kinds.some((kind) => EXPENSES_FOR_KIND[kind]?.some((e) => typicalExpenses.includes(e)));
}
