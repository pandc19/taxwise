/**
 * Hash of what the taxpayer told us about their work (ADR-017): the AI's
 * remembered answers are valid only for the profile they were given. Like
 * the activity fingerprint, it ignores the order of the lists and
 * insignificant whitespace in the description.
 *
 * Pure: no I/O, no infrastructure import (ADR-001).
 */

import { createHash } from 'crypto';

export interface WorkProfile {
  workDescription: string | null;
  workSetup: string[];
  typicalExpenses: string[];
}

export function computeWorkProfileHash(profile: WorkProfile): string {
  const normalized = JSON.stringify({
    d: (profile.workDescription ?? '').trim().replace(/\s+/g, ' ').toLowerCase(),
    s: [...profile.workSetup].sort(),
    e: [...profile.typicalExpenses].sort(),
  });
  return createHash('sha256').update(normalized).digest('hex');
}
