/**
 * IVA domain layer (pure, no I/O).
 * Exports all domain services: parsing, validation, classification, calculation.
 */

// Access Key
export {
  parseAccessKey,
  calculateCheckDigit,
  verifyAccessKeyConsistency,
} from './access-key';
export type { DecomposedAccessKey } from './access-key';

// Activity Fingerprint
export { computeActivityFingerprint } from './activity-fingerprint';

// Proportionality
export {
  calculateProportionalityFactor,
  applyFactorToVat,
  calculateUncreditedVat,
} from './proportionality';
export type {
  SaleForFactor,
  ProportionalityCalculation,
} from './proportionality';

// Classification Cascade
export {
  classificationCascade,
  requiresManualReview,
  categoryFor,
  AI_ACCEPTANCE_THRESHOLD,
  PROFILE_MIN_CONFIDENCE,
} from './classification-cascade';
export type {
  ClassificationInput,
  ClassificationDecision,
  SupplierRule,
  SupplierFacts,
  AiRelevanceDecision,
  Relevance,
  PurchaseTreatment,
} from './classification-cascade';

// Supplier knowledge and work profile (ADR-017)
export { SUPPLIER_KINDS, WORK_SETUPS, TYPICAL_EXPENSES, kindsCoveredBy } from './supplier-kinds';
export type { SupplierKind, WorkSetup, TypicalExpense } from './supplier-kinds';
export { computeWorkProfileHash } from './work-profile';
export type { WorkProfile } from './work-profile';

// Calculator
export { calculatePeriodResults } from './calculator';
export type { ClassifiedInvoice, CalculationContext } from './calculator';

// Types
export {
  IvaCategoryEnum,
  SalesTreatmentEnum,
  RESULT_KEYS,
  DomainError,
  AccessKeyInvalidError,
} from '../types';
export type { ResultKey, CalculationResult } from '../types';
