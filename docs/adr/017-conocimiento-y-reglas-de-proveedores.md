# ADR-017: Supplier knowledge and rules

## Status
Accepted and implemented (2026-10-22). The open questions were settled with
the defaults recorded below; the first one still needs an accountant's
confirmation.

## Date
2026-10-22

## Replaces
In part: the cascade order of [ADR-005](005-clasificacion-en-cascada.md),
the rule semantics of [ADR-006](006-reglas-por-proveedor-y-actividad-economica.md),
and the AI request of [ADR-007](007-modo-sin-ia-y-catalogo-compartido.md).
Their other parts stand.

## Context

Checking a real period (September 2026, one exporter of services) showed the
supplier rules are not reliable:

1. **One manual decision becomes a rule for the whole supplier.** Classifying
   a single Kywi invoice as non-deductible created a rule that classified
   every other Kywi invoice the same way, without the user touching them.
   The same would happen with any supplier that sells both business and
   personal things (hardware, supermarkets, banks).
2. **AI answers are not remembered.** Only manual decisions create rules, so
   the AI re-decides the same supplier every run. DirecTV's identical
   invoices came back `CREDIT` once and `NON_DEDUCTIBLE` another time. That
   is the inconsistency ADR-005 set out to prevent.
3. **The AI is asked two questions as one.** "Does this relate to the
   user's work?" and "does it give credit?" are different: the second
   depends on the user's own tax position, which the AI never sees.
4. **The AI knows too little about the user.** "PRESTACION DE SERVICIOS
   PROFESIONALES" says nothing about needing hardware or office supplies, so
   it judged a steel supplier unrelated and a satellite-TV provider
   personal, with no way to be told otherwise.
5. **It pays to look the supplier up on every run.** What a supplier sells
   does not depend on the buyer; it is asked again for every taxpayer.
6. **A stale rule blocks everything.** After an activity change the rule is
   skipped, yet its mere existence also prevents the AI from being asked, and
   the "reconfirm in bulk" step of ADR-006 was never built.
7. **`users.ai_enabled` is never read**, so the no-AI mode of ADR-007 is not
   actually enforced.

## Decision

### 1. Two kinds of knowledge, stored separately

**What a supplier is** is a fact that does not depend on who buys. It is
looked up once per RUC and stored in a global table, `supplier_profiles`
(no taxpayer data, no RLS, like `shared_supplier_catalog`):

```
supplier_profiles
├── supplier_ruc (PK), supplier_name
├── kinds[]           ← from a closed list: TELECOM_INTERNET, BANKING_PAYMENTS,
│                       SUPERMARKET_GROCERY, RESTAURANT_FOOD, FUEL,
│                       HARDWARE_CONSTRUCTION, OFFICE_SUPPLIES, ...
├── summary           ← what it usually sells, one or two sentences
├── mixed_use         ← sells things that are business for some buyers and
│                       personal for others (hardware, department stores)
├── confidence, model_id, prompt_version, created_at
```

This request carries only the supplier's RUC and name (public data) and no
buyer information at all. It is repeated only when `prompt_version` changes.

**What it means for this user** is a decision about a relationship, and it is
the user's own. It is a *relevance*, not a category:

```
RELATED | NOT_RELATED | UNSURE
```

### 2. The AI answers relevance only; the category is derived

The AI never says `CREDIT` or `COST_EXPENSE`. It says whether purchases from
this supplier relate to the user's work. The domain then derives the stored
category from the taxpayer's own setting (`purchase_treatment`), so credit vs.
cost is the user's explicit choice and is no longer guessed:

| Relevance | `purchase_treatment = CLAIM_CREDIT` | `= DEDUCT_AS_EXPENSE` |
|---|---|---|
| RELATED | `CREDIT` | `COST_EXPENSE` |
| NOT_RELATED | `NON_DEDUCTIBLE` | `NON_DEDUCTIBLE` |
| UNSURE | review queue | review queue |

Changing the setting reclassifies derived categories; rules and cached
answers store relevance, so they stay valid.

### 3. What the user tells us about their work

The activity code alone is too vague. Three inputs are added to the taxpayer,
structured so they are easy to answer:

- **What you do and for whom** — one short free-text line (≤ 280 chars), with
  a warning not to include names or personal data.
- **How you work** — tags: remote / home office, own premises, field work,
  own equipment.
- **What you typically buy for work** — a checklist: internet, mobile, hardware
  or equipment, maintenance and tools, office supplies, software or
  subscriptions, bank and payment fees, transport, rent, utilities,
  professional services.

These are sent to the AI instead of the taxpayer's identity (never the RUC or
name, per ADR-007). The activity fingerprint of ADR-006 stays activities-only;
the work profile gets its own hash, used below.

### 4. Rules are explicit

- A manual classification applies to **that voucher only**: source `USER`,
  and automatic reclassification never touches it.
- A rule is created only when the user chooses *"Aplicar a todos los
  comprobantes de este proveedor"*. The rule stores relevance, keyed by
  `(taxpayer, supplier, activity fingerprint)` as in ADR-006.
- A supplier flagged `mixed_use` shows a warning on that choice, and is never
  decided by the AI: its vouchers go to review one by one.
- If the user classifies one supplier two different ways, it is treated as
  mixed and any automatic rule for it stops applying.
- A new **Proveedores** screen lists each supplier with its profile, the rule
  (if any) and who made it, and lets the user revoke or change it. Today
  there is no way to see or undo a rule.

### 5. AI answers are remembered

An AI relevance answer is stored as a `supplier_rules` row with
`source = AI`, together with its confidence, reasoning, `model_id` and
`prompt_version`, keyed by the activity fingerprint and the work-profile hash.
The next period finds it before asking again, so the same supplier is decided
the same way until the user's profile changes, and the answer is explainable
two years later (the goal of ADR-005).

### 6. The cascade

```
1. Explicit user rule            (taxpayer, supplier, fingerprint)   deterministic
2. Remembered AI answer          (same fingerprint + work profile)   deterministic
3. Supplier kinds × work profile (e.g. TELECOM_INTERNET + "internet") deterministic
4. AI, relevance only            (profile summary + work profile)    skipped if mixed_use
5. Review queue
```

A stale rule (fingerprint changed) no longer blocks levels 3–5: it is shown
in the review queue as *"antes lo marcaste como X"* for bulk reconfirmation,
which is the revalidation ADR-006 asked for. The anonymous crowdsourced
catalog of ADR-007 (level 2 there) is left as it is — unbuilt and out of
scope here.

### 7. No-AI mode is enforced

`getAiClassifier()` returns `null` when the user's `ai_enabled` is false. With
the AI off, levels 1–3 and 5 still work.

## Phases

1. **Opt-in rules** *(done)* — manual = per voucher, explicit "apply to
   supplier", a rule revoked when the user classifies that supplier
   differently, stale rules no longer blocking the AI, the Proveedores
   screen (change, revoke, reconfirm stale), `ai_enabled` enforced. 
2. **Supplier profiles** *(done)* — `supplier_profiles` and the supplier-only
   AI call.
3. **Work profile and relevance** *(done)* — the taxpayer inputs,
   `purchase_treatment`, relevance-only AI, remembered answers,
   deterministic level 3; rules now store relevance.

## Consequences

### Positive
- One manual decision can no longer silently reclassify a supplier.
- The AI is consistent across periods and across runs, and asked far less.
- The user's own tax position (credit vs. expense) is an explicit setting,
  not an AI guess.
- Supplier facts are shared across all taxpayers at no privacy cost.

### Negative
- More to build and to keep in sync: a table, a screen, three taxpayer
  inputs, a derivation step.
- More manual review at first for mixed suppliers (they are never
  auto-decided).
- `supplier_rules` rows will hold relevance instead of a category (phase 3).
  Existing development data is not migrated; `npm run db:reset` starts clean.

## Open questions — settled

- **Default `purchase_treatment`: `CLAIM_CREDIT`**, always visible and
  editable on the taxpayer form with a notice that it is the user's own
  decision to confirm with an accountant. It follows what the SRI says about
  exporters (credit by Art. 66 LRTI; refund by Art. 72 as a separate path).
  **This still needs an accountant's confirmation before real use.**
- **The closed list of supplier `kinds`** lives in
  `src/domain/iva/supplier-kinds.ts`; `OTHER` is allowed and simply never
  matches level 3, so it falls to the AI.
- **A supplier the AI doesn't recognise** (profile confidence below 0.70) is
  treated like a mixed-use one: no kind match, no relevance call, review. A
  profile is a fact about the world; judging a buyer from a guess only hides
  the guess. Profiles use the strong model since they are asked once per RUC.
- **`mixed_use` suppliers are never auto-decided** (no profile match, no AI);
  only an explicit user rule decides them. Revisit once there is real data on
  how often this sends vouchers to review.

## Alternatives considered

**Keep category-valued rules and only add an opt-in checkbox.** Smallest
change and enough for Kywi, but leaves the AI inconsistent and the credit
question unresolved. It is phase 1 of this ADR, not the whole answer.

**Replace rules with the supplier profile alone.** The profile says what a
supplier sells, not whether *this* user's purchase from it relates to their
work. That judgment still has to be stored somewhere, so rules stay, but only
when asked for.

**Send the supplier name and the buyer's profile in one AI call.** Simpler,
but it repeats the supplier lookup for every taxpayer and cannot be cached
across them.
