# How Taxwise works

A real walk-through of a period, screen by screen, with the routes and
Server Actions exactly as they exist in the code today. For the *why*
behind each decision, see the linked ADRs — this document describes the
*what*, not the *why*.

---

## Accounts and access

NextAuth v5, email and password (`src/lib/auth.ts`), JWT session,
`bcryptjs` for hashing.

- **Register** — `/[locale]/register` → `registerUser()` creates the user
  directly against `prisma` (the `users` table has no RLS). It doesn't
  create any taxpayer.
- **Login** — `/[locale]/login`, `signIn()` from `next-auth/react` on the
  client.
- **Logout** — button at the bottom of `AppSidebar`
  (`src/components/logout-button.tsx`), visible throughout the app,
  `signOut()` from `next-auth/react`.
- **Route protection** — `src/proxy.ts` is an allowlist, not a
  denylist: every route requires a session except `/login`, `/register`,
  and the landing page (`/`, which just redirects). This way a new screen
  is protected by default without anyone having to remember to add it to
  a list. Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`;
  with a `src/` directory, it also only recognizes the file inside
  `src/`.
- **Role** — `users.role` (`INDIVIDUAL | ACCOUNTANT | ADMIN`) travels in
  the session JWT (`src/lib/auth.ts`, `jwt`/`session` callbacks) so the
  sidebar knows whether to show the admin link without a separate query.
  **That claim is never used to authorize an actual action** — a JWT is
  long-lived and could still say `ADMIN` after someone loses the role;
  `requireAdmin()` (`src/lib/session.ts`) re-queries `users` directly
  before letting any `/admin` Server Action through.

## Navigation

Two nested layouts under `(app)`, plus a sidebar component:

- **`AppSidebar`** (`src/components/app-sidebar.tsx`, client) — mounted
  by `(app)/layout.tsx`, wraps every authenticated screen. Always visible
  on desktop (`md:block`); on mobile it's a sliding panel with a
  hamburger button (local `useState`, no state library). Links: "My
  taxpayers" always, "Administration" only if
  `session.user.role === 'ADMIN'`. Highlights the active section by
  comparing `usePathname()`.
- **`BackBar`** (`src/components/back-bar.tsx`, client) — mounted by
  `(app)/layout.tsx`, so every screen gets the same "Back" link. The
  target is the screen's *logical parent*, computed from the URL by
  `parentPath()` (step → period overview → periods → taxpayers; admin
  detail → admin list), not `history.back()`, so it also works after a
  refresh or from a deep link. Hidden on `/taxpayers`.
- **`[taxpayerId]/layout.tsx`** — wraps everything under a given taxpayer
  (`periods`, `suppliers`, `edit`). Secondary strip: business name + three
  icon buttons ("Periods" = `Calendar`, "Suppliers" = `Store`, "Edit
  taxpayer" = `SquarePen`, each
  with `title`/`aria-label` since they carry no visible text). Calls
  `getTaxpayer()` once per request; each child page may query it again
  if it needs more than the name (there's no memoization between layout
  and page yet).

The cards on `/taxpayers` and `/[taxpayerId]/periods` follow the
same pattern: a `<Link>` wraps the name/icon (primary navigation, one
click enters the taxpayer or the period) and the secondary controls —
icon buttons to edit, a `Select`, or a delete button — sit as siblings of
the `<Link>` within the same `CardHeader`, never nested inside it (a
`<button>` inside an `<a>` is invalid HTML and breaks keyboard focus).

**Modals instead of inline forms** — creating a period
(`periods-client.tsx`) and loading a VAT rate (`admin/rates/...`)
both use `src/components/ui/dialog.tsx` (a wrapper around `radix-ui`'s
`Dialog`, the first use of it in the project). Modal was chosen over a
full page for short actions on a small form that don't need their own
URL; creating/editing a taxpayer stays a full page because it has too
many fields (a variable-length list of economic activities) for a modal.

Within a period, the four steps (`ingestion`, `sales`, `reconciliation`,
`pre-filing`) share `period-step-nav.tsx`, rendered once by the period's
`layout.tsx`: a tab bar with the four steps in order, the current one
highlighted (derived from the URL), each one a direct link to the others,
and a grid icon back to the period overview. The overview
(`[periodId]/page.tsx`) is four cards, one per step.

## 0. Taxpayers and periods

**Routes:** `/[locale]/(app)/taxpayers`, `/[locale]/(app)/taxpayers/new`,
`/[locale]/(app)/[taxpayerId]/edit`, `/[locale]/(app)/[taxpayerId]/periods`
**Server Actions:** `getMyTaxpayers()`, `createTaxpayer()`
(`taxpayers/actions.ts`); `getTaxpayer()`, `updateTaxpayer()`
(`[taxpayerId]/actions.ts`); `getTaxpayerPeriods()`, `createPeriod()`,
`updatePeriodStatus()`, `deletePeriod()` (`[taxpayerId]/periods/actions.ts`)

The landing page (`/[locale]`) redirects: to `/taxpayers` with a session,
to `/login` without one. There are no more demo routes with fixed ids.

- `/taxpayers` lists the user's taxpayers (via `user_taxpayers`,
  filtered by RLS) and leads to `/taxpayers/new`, `/[taxpayerId]/periods`,
  or `/[taxpayerId]/edit`.
- The taxpayer form also asks about their work (a short description,
  how they work, what they typically buy for work) and how to treat the IVA
  of purchases related to it (`purchase_treatment`); see Reconciliation.
- `createTaxpayer()`/`updateTaxpayer()` compute `activityFingerprint` with
  `computeActivityFingerprint()` (`domain/iva/activity-fingerprint.ts` —
  a hash of the sorted economic activities, ADR-006) every time
  activities are saved. When it changes, the user's own supplier rules
  become "Por reconfirmar" on the Suppliers screen and stop applying until
  reconfirmed (ADR-006, ADR-017), and remembered AI answers are asked
  again. A duplicate RUC returns
  `RUC_IN_USE` in both actions, not an unhandled exception. The form
  (`taxpayer-form.tsx`, shared between create and edit) doesn't let the
  RUC be edited beyond format validation; if it changes, uniqueness is
  rechecked excluding the taxpayer itself.
- `/[taxpayerId]/periods` lists the taxpayer's periods and allows
  creating a new one (year + month → `periodStart`/`periodEnd`, monthly
  and IVA for now). The actual uniqueness constraint is
  `(taxpayerId, taxType, periodStart)`, not year/month as such.
  - **Changing status** (`updatePeriodStatus`) only moves between
    `DRAFT ↔ UNDER_REVIEW` and writes an event to `classification_events`
    (ADR-013, rule 6). `FILED` is deliberately left out — it's
    `lockPeriod()`/`reopenPeriod()` (pre-filing screen, see
    section 4) because those two also set/clear `locked_at`, which
    triggers Postgres's voucher lock.
  - **Deleting a period** (`deletePeriod`) only works in `DRAFT` status
    and with no vouchers (`invoices_received`/`invoices_issued` at
    zero) — if either condition fails, it returns `NOT_DRAFT` or
    `HAS_DATA` without touching anything. It's the only deletion path
    that exists for a period; there's no equivalent for a taxpayer
    (see below).

**Taxpayers cannot be deleted.** The `taxpayers` table only has RLS
policies for `SELECT`/`INSERT`/`UPDATE` — no `DELETE`, not even for
`is_system_admin()`. With `FORCE ROW LEVEL SECURITY`, the absence of a
policy for a command blocks that command entirely, not just filters it.
This is deliberate (consistent with the immutable audit log of ADR-013):
if it's needed in the future, it's a new product decision, not a missing
`DELETE` to add. `classification_events` goes a step further: a Postgres
trigger rejects `DELETE`/`UPDATE` on that table unconditionally, for any
role, superuser included — it's not RLS (which the superuser does
ignore), it's an actual trigger. Any period with at least one event (any
status transition) becomes permanently undeletable, and with it its
taxpayer. See
[`TROUBLESHOOTING.md`](../../TROUBLESHOOTING.md).

## Data access

Every query on taxpayer tables goes through `withUser(userId, fn)`
(`src/lib/db.ts`), which sets `app.current_user_id` with `SET LOCAL`
inside a single `$transaction` — never as two separate calls, because
with a connection pool the `SET` and the query could land on different
connections and RLS would silently be lost. `asAdmin(fn)` exists for
userless paths (seeding, admin tasks) and sets an explicit sentinel id,
never `RESET` — an unset variable must fail closed, not open. See
[ADR-004](../adr/004-per-user-rls-with-prisma.md).

## 1. Ingestion

**Route:** `/[locale]/(app)/[taxpayerId]/periods/[periodId]/ingestion`
**Server Action:** `uploadSourceFiles()` (`ingestion/actions.ts`)
**Layers:** page → `services/ingestion` (parsing and validation) →
`services/storage` (saves the raw file) → `domain/iva/access-key`
(access-key consistency) → `withUser()`

One file at a time for now (the SRI's multi-file upload layout —
one file per day — still has no UI).

Per file:
1. Compute `sha256` and detect the file type from the header columns
   (`detectFileType` — 12 columns with `RUC_EMISOR` = received, 8 with
   `COMPROBANTE` = issued). See
   [`../tax/sri-file-format.md`](../tax/sri-file-format.md).
2. Validate every row (below). A row whose only problem is `DUPLICATE`
   (already imported by an earlier upload) is *skipped*, not an error. If
   nothing new would be imported, stop here: no `source_files` row, no
   stored copy.
3. Otherwise save the raw content to disk (`saveSourceFile()`,
   `src/services/storage/`) at `storage/<taxpayerId>/<sha256>.txt`,
   inside the DB transaction and before the `source_files` insert, so a
   failed write leaves no row pointing at a missing file; keyed by hash
   so a retry overwrites instead of piling up orphans.
4. Register it in `source_files`.

The page (`ingestion/page.tsx`, server) also lists what the period already
holds via `getPeriodIngestion()`: upload history plus the received and
issued vouchers and shows the "continue" link whenever the period has any
(always to the next step, Issued sales);
`ingestion-client.tsx` is the upload form and result.

**Removing an upload** (`removeSourceFile()`, trash icon per file): in one
transaction it deletes the vouchers imported from that file, the period's
computed `period_results` (stale now; recomputed on demand) and the
`source_files` row, and logs a `source_file` event. Afterwards the stored
copy is deleted unless another upload of the same taxpayer has the same
hash. Refused once the period is filed/locked. Classification events are
kept (immutable, no FK to vouchers); learned supplier rules are kept too.
Several files per period are fine: dedup is by access key.

Per row (`ingestionService.validateReceivedRow`/`validateIssuedRow`):
1. Decompose the `CLAVE_ACCESO` and cross-check it against date, type,
   RUC, and series
   ([ADR-009](../adr/009-access-key-as-deduplication-key.md)).
2. Verify the voucher belongs to the period's taxpayer
   (received: `IDENTIFICACION_RECEPTOR`; issued: the RUC embedded in the
   access key).
3. Verify `FECHA_EMISION` falls within the period.
4. Verify the type against the allowlist in
   `services/ingestion/ingestion-service.ts` →
   `VOUCHER_TYPE_WHITELIST` ([ADR-010](../adr/010-treatment-by-voucher-type.md)).
   An unknown type → warning, not rejection; it falls to manual review in
   the classification step.
5. Insert via `upsert` on `(taxpayer_id, access_key)` — re-uploading the
   same file duplicates nothing.

**Once finished, vouchers are saved with
`processing_status = UNCLASSIFIED`.** If anything fails afterward,
nothing is lost
([ADR-011](../adr/011-two-step-ingestion-and-classification.md)).

## 2. Issued sales

**Route:** `.../sales`
**Server Actions:** `getPendingSales()`, `markSalesTreatment()`
(`sales/actions.ts`)

The issued-invoices file doesn't indicate why a sale has `IVA = 0`
(export, 0% with or without the right to credit, non-object/exempt), nor
does it carry the customer or a description. This screen is where the
user resolves that ambiguity.

- Sales with `IVA > 0` become `TAXED` automatically.
- Sales with `IVA = 0` start as `UNCLASSIFIED`, and the user marks each
  one (or several at once) with its actual destination. Each mark calls
  `markSalesTreatment()`, which updates `invoices_issued.sales_treatment`
  and writes an event to `classification_events`
  ([ADR-013](../adr/013-immutable-audit-log-and-period-lock.md)).

The proportionality factor (pre-filing screen) is not calculated while
any sale remains `UNCLASSIFIED`.

## 3. Reconciliation

**Route:** `.../reconciliation`
**Server Actions:** `getPurchasesByStatus()`, `classifyPeriod()`,
`applyManualClassification()`, `getAiNotes()`, `getSupplierProfiles()`
(`reconciliation/actions.ts`)

Only vouchers with `IVA > 0` enter here
([ADR-008](../adr/008-totals-only-no-line-items.md)).

**`classifyPeriod()`** — step 2 of ingestion
([ADR-011](../adr/011-two-step-ingestion-and-classification.md)): groups
open vouchers (`UNCLASSIFIED` or left in `REQUIRES_MANUAL_REVIEW` by an
earlier run) by supplier and runs the
`classificationCascade.classify()` cascade
([ADR-005](../adr/005-classification-cascade.md)):

```
┌─ Level 1 ── the user's own supplier rule (current activity fingerprint)
│             ↓ no match
├─ Level 2 ── an earlier AI answer for the same activities + work profile
│             (a supplier_rules row with source = AI)
│             ↓ no match
├─ Level 3 ── the supplier's kind matches something the user buys for work
│             (supplier_profiles × taxpayers.typical_expenses; never for a
│             mixed-use supplier, or one the AI doesn't recognise: profile
│             confidence < 0.70)
│             ↓ no match
├─ Level 4 ── AI relevance answer (src/services/ai/) — null in no-AI mode
│             (mixed-use suppliers: never)
│             ↓ no match
└─ Review ─── manual queue (processing_status = REQUIRES_MANUAL_REVIEW)
```

The cascade decides only whether a supplier **relates to the taxpayer's
work** (`RELATED` / `NOT_RELATED`). The stored category is then derived from
the taxpayer's own `purchase_treatment` — `CLAIM_CREDIT` gives `CREDIT`,
`DEDUCT_AS_EXPENSE` gives `COST_EXPENSE`, not related gives
`NON_DEDUCTIBLE` — so the AI never decides credit
([ADR-017](../adr/017-supplier-knowledge-and-rules.md)). Changing
`purchase_treatment` is followed by "Reclasificar todo" on each open period;
vouchers decided by the user keep their category.

**Classifying again.** `classifyPeriod(taxpayerId, periodId, options)`
takes `{ reclassify: true }` ("Reclasificar todo": every voucher whose
source isn't `USER`) or `{ invoiceIds }` ("Reclasificar automáticamente"
on the selected rows, whatever their state). Manual decisions are never
touched by `reclassify`, and a supplier rule the user created still wins
over the AI. A re-run that can't decide leaves an already-`PROCESSED`
voucher as it was, with two exceptions that send it back to Pendientes: the
AI answered below 0.80, or the supplier is now known to need the user
(mixed-use, or one the AI doesn't recognise). An AI failure or no-AI mode
changes nothing. The plain "Clasificar ahora" button only handles vouchers
still waiting. Every change logs an event with the old and new value.

The tabs are: Sin clasificar, Con crédito tributario, Costo o gasto, No
deducible, Pendientes, and Sin IVA (informativo).

Each tab has a one-line description under the tab bar (and a `title`
tooltip on the button), and every classified row shows who decided it:
an **IA** / **Manual** / **Regla** / **Catálogo** badge from
`invoices_received.classification_source`. A manual move sets the source to
`USER`, so a voucher the AI classified and the user later changed shows
**Manual**.

The "Sin IVA (informativo)" tab lists vouchers with `IVA = 0`: read-only,
no selection, they never enter the cascade.


A voucher type outside the allowlist within the group sends the whole
supplier to manual review without going through the cascade
(`requiresManualReview()`, which uses the single boolean ingestion
already computed — there's no separate second list of "standard types").

**The AI** only runs when levels 1–3 wouldn't already decide, and asks two
separate questions (`src/services/ai/`):

1. *What is this supplier?* — `profileSupplier()`: one call per RUC, to the
   the supplier model (it is world knowledge, asked once and shared), answer
   stored globally in `supplier_profiles` (kinds, a one-line summary, a
   `mixed_use` flag, confidence, model and prompt version). It carries only
   the supplier's RUC and name — no buyer information — and is repeated only
   when the prompt version changes (profiles written by an older version are
   asked again on the next run). `mixed_use` is strict: only hardware and
   building-materials stores, general retail and fuel stations.
2. *Does it relate to this taxpayer's work?* — `judgeRelevance()`: carries the
   stored profile plus the buyer's economic activities, regime, work
   description, work setup and typical expenses — never the taxpayer's RUC or
   name (ADR-007). An accepted answer (confidence ≥ 0.80, not `UNSURE`) is
   stored as a `supplier_rules` row with `source = AI`, together with its
   reasoning, model and prompt version, so the same supplier is decided the
   same way next period until the activities or work profile change
   (`computeWorkProfileHash()`); it never overwrites one of the user's own
   rules.

`getAiClassifierFor(userId)` (`src/services/ai/user-provider.ts`) builds the
classifier from the **user's own settings** (provider, decrypted key,
workspace, model — see Settings below) and returns `null` when there is no
key: that is the no-AI mode of ADR-007 ([ADR-018](../adr/018-ai-set-up-by-each-user.md)).
`ClaudeClassifier` and `OpenAiClassifier` (`src/services/ai/providers/`)
implement the same `AiClassifier` interface. `modelsFor()` gives a *bulk*
and a *deep* model for the normal work (the one model the user chose in
`users.ai_model` fills both; none chosen means the provider's pair) and a
separate *supplier* model (`users.ai_supplier_model`, default the provider's
strong one). Relevance is asked of the bulk model; the retry on the deep one
when confidence is below 0.80 exists in the providers but is switched off
(`DEEP_RETRY_ENABLED` in `models.ts`). Both use structured output (Zod schema via each SDK's own
helper), never prose parsing. A `classification_events` row for a supplier
the AI was consulted about records `model_id`, `prompt_version`,
`ai_confidence` and `ai_reasoning` (also when the answer was below 0.80 and
the voucher went to review, and for a remembered answer, copied from the
rule), and the Conciliación table shows it in an info dialog via
`getAiNotes()`. The prompt text itself isn't stored: it lives in code and
`prompt_version` points to it (`PROFILE_PROMPT_VERSION` and
`RELEVANCE_PROMPT_VERSION` in `src/services/ai/types.ts`, bumped whenever a
prompt's wording or schema changes).

**Not yet done:** the Batch API pass CLAUDE.md's model table calls for
("Batch API para el pase masivo"). `classifyPeriod()` runs in three
phases so no AI call sits inside a DB transaction (Prisma's 5 s limit
expired it with ~23 suppliers): (1) read vouchers, taxpayer, rules and supplier profiles in
one transaction; (2) ask the AI per supplier, 5 at a time, outside any
transaction (a failure is counted and reported, not thrown); (3) decide
and write with `updateMany`/`createMany` in one short transaction. Still
synchronous within the request — revisit once a period's supplier count
makes that slow ([`NEXT_STEPS.md`](../../NEXT_STEPS.md)).

**`applyManualClassification()`** — manual classification, single or in
bulk ([ADR-017](../adr/017-supplier-knowledge-and-rules.md)):
1. Updates `iva_category` and `processing_status = PROCESSED` on the
   **selected vouchers only** (source `USER`).
2. Writes an event to `classification_events`.
3. Creates or updates the supplier rule (level 1) **only if the user ticked
   "Aplicar a todos los comprobantes de este proveedor"**. A supplier often
   sells both business and personal things, so a single decision doesn't
   classify the rest. The rule stores a relevance (related / not related),
   not a category. If the user's own rule for the supplier says the opposite
   of what they just chose for a voucher, that rule is revoked (mixed use)
   and the event's reason says so; a remembered AI answer is left alone.

**Supplier rules screen** (`/[taxpayerId]/suppliers`, button in the
taxpayer's top strip): lists the taxpayer's active rules, lets the user
change or revoke each one, and reconfirm in bulk the ones issued under an
older activity fingerprint ("Por reconfirmar"; those are not applied, and
no longer stop the AI from being asked). Changing or revoking a rule never
touches vouchers it already classified.

**No-AI mode** is read from `users.ai_enabled` in `classifyPeriod()`; with
it off (or no provider key) the cascade goes straight from rules to review.

## 4. Pre-filing

**Route:** `/[locale]/(app)/[taxpayerId]/periods/[periodId]/pre-filing`
(step 4 of 4)
**Server Actions:** `computePeriodResults()`, `getPeriodResults()`,
`lockPeriod()`, `reopenPeriod()` (the period's `actions.ts`)

**The period root is the wizard overview, one level above the steps.**
`[periodId]/page.tsx` always renders `PeriodOverview`: four cards, one
per step (Ingestion, Issued sales, Reconciliation, Pre-filing), the
first marked "start here" only while the period has no vouchers.
`[periodId]/layout.tsx` wraps every screen under the period with the
period's title and `PeriodStepNav` (client; derives the current step
from the URL, hides itself on the overview, and has a grid icon that
returns to it).

**`computePeriodResults()`** calls `calculatePeriodResults()`
(`src/domain/iva/calculator.ts`) over the period's vouchers — pure
domain logic, no aggregation SQL, tested without a database
([ADR-001](../adr/001-nextjs-monolith-with-domain-layer.md)) — and
saves each result to `period_results`. The domain produces **stable
keys** (`SALES_TAXED`, `PURCHASES_WITH_CREDIT`, `PROPORTIONALITY_FACTOR`…).
The system does not know Form 104's fields
([ADR-016](../adr/016-results-not-mapped-to-form-fields.md)); the
screen shows these keys in plain language.
Each purchase and taxed-sale result comes as a base and an IVA amount
(`PURCHASES_WITH_CREDIT` / `…_VAT`, `PURCHASES_NO_CREDIT` / `…_VAT`,
`SALES_TAXED` / `…_VAT`). The applicable credit is the IVA of purchases
**with** a right to credit times the factor; the IVA of cost-or-expense
purchases never counts as credit. The screen calculates by itself the first
time a period is opened, and "Recalcular" refreshes it after any change.

The proportionality factor
(`src/domain/iva/proportionality.ts`) counts exports and 0% sales with
the right to credit in the numerator; a taxpayer who only exports
services has a factor of `1.0000`
([`../tax/vat-calculation.md`](../tax/vat-calculation.md)). It is
blocked — with an explicit reason, never a made-up number — if there are
unmarked sales or if there are no sales in the period (zero
denominator).

**`lockPeriod()`** sets `tax_periods.status = FILED` and `locked_at`, and
writes an event. A Postgres trigger
(`prisma/migrations/*_add_period_lock/`) rejects INSERT, UPDATE, and
DELETE on `invoices_received`/`invoices_issued` for the period while it's
locked — it lives in the database, not the application, so no path can
bypass it ([ADR-013](../adr/013-immutable-audit-log-and-period-lock.md)).

**`reopenPeriod()`** clears `status`/`locked_at` and also writes an
event — the reopening itself is logged, not just whatever gets edited
afterward. Exposed in the UI (`pre-filing-client.tsx`) as the "Reabrir
período" button, visible only when the period is filed. Marking a period
as filed ("Marcar como presentado en el SRI") only records that the user
filed it themselves; the system never files anything.

## 5. Administration

**Route:** `/[locale]/(app)/admin/rates`
**Server Actions:** all in `admin/actions.ts`, all behind
`requireAdmin()`, all running with `asAdmin()` — never `withUser()`,
because the admin doesn't own any taxpayer.

The admin belongs to the system: they load verified VAT rates, and don't
see taxpayer data or intervene in results — the disclaimer in
`admin/layout.tsx` says so explicitly on screen. There is no form
administration: the system doesn't know Form 104's fields
([ADR-016](../adr/016-results-not-mapped-to-form-fields.md)).

- **`createTaxRate()`** requires `source` and `verifiedAt` on the form
  itself — it can't be submitted without both (CLAUDE.md → "Normative
  values"). **No rate is loaded at all**: no row in
  [`docs/tax/vat-rates.md`](../tax/vat-rates.md) is verified yet, so
  `/admin/rates` exists but its table stays empty in any real
  environment.
- **`updateTaxRate()` / `deleteTaxRate()`** back the pencil and trash
  icons. A rate's `(tax, valid_from)` key isn't editable — delete and
  recreate.

## 6. Settings (AI)

**Route:** `/[locale]/(app)/settings/ai` (sidebar: "Inteligencia artificial")
**Server Actions:** `getAiSettings()`, `saveAiSettings()`,
`removeAiSettings()` (`settings/ai/actions.ts`)

The user picks Anthropic or OpenAI, enters their API key, optionally an
Anthropic workspace id and one model for the normal AI work (both tiers) and one for identifying suppliers. `saveAiSettings()` validates the shapes,
then **checks them with the provider using free requests** (list models,
retrieve each chosen model — `verifyAiSettings()`), then stores the key encrypted
(`src/lib/secret-box.ts`, AES-256-GCM, `ENCRYPTION_SECRET`, user id as
authenticated data). The key is never returned: the screen shows the provider
and the last four characters. Leaving the key empty keeps the saved one when
the provider hasn't changed. Without `ENCRYPTION_SECRET` the form says saving
isn't available. Removing the key switches the AI off.

## Still to be built

See [`NEXT_STEPS.md`](../../NEXT_STEPS.md) for the full list. The most
relevant item for understanding the current state:

- The anonymous, crowdsourced supplier catalog (ADR-007) was never built;
  supplier knowledge today comes from `supplier_profiles` (ADR-017).
