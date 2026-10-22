# Next steps

What's already resolved lives in [`CHANGELOG.md`](CHANGELOG.md), not here.

## Open decisions

**Where to deploy.** DigitalOcean is the leading option based on prior
experience (droplet + Docker + Caddy + Terraform + Cloudflare, the pattern
from `comprobify-web/docs/adr/008`). Not decided until there's something
to deploy. A warning on record from that project: **the cheapest droplet
fell short for Next.js with Prisma.** Start at least one tier up.

**Retention of stored source files.** Uploaded `.txt` files are now kept
on the local filesystem (`src/services/storage/`, since 2026-10-04), so
a period can be reprocessed without re-asking for them. Still
undecided: whether they're kept indefinitely or archived/deleted after
some period, and whether production needs S3-compatible storage instead
of a local disk (today there's only a local driver, no abstraction to
swap it).

**Terms and conditions.** [ADR-014](docs/adr/014-assistive-character-and-disclaimers.md)
sets the product stance. The legal text needs professional review before
opening to real users.

## To build

- [ ] **Confirm `purchase_treatment`'s default with an accountant**
      (ADR-017): `CLAIM_CREDIT` follows what the SRI says about exporters,
      but it is a tax position the user owns.
- [ ] **Domain tests** (`src/domain/iva/`): no runner is configured. Throwaway
      scripts checked the classification cascade (24 cases: rule precedence,
      stale rules, remembered AI answers, mixed-use and unknown suppliers,
      thresholds) and the calculator (10 cases, including that cost-or-expense
      purchases never give credit); they should become real tests.
- [ ] **A per-supplier "ask again" and a way to correct a supplier profile.**
      A profile is shared by every taxpayer and refreshed only when its
      prompt version changes; a wrong or "not recognised" profile stays that
      way until then.
- [ ] **Reclassifying a period that was marked as filed.** The database
      blocks changes to its vouchers; how the screen reports that has not
      been checked. Reopen the period first.
- [ ] **Verify the default model ids.** `claude-opus-5` (the Claude
      escalation and profile model) was never confirmed against the API.
- [ ] **Spanish identifiers left on purpose:** the `es.json` namespaces and
      keys (`Conciliacion`, `Proveedores`, `PreDeclaracion`, `Admin.tasas*`)
      are not file names and were not renamed; the UI text is Spanish by
      design.
- [ ] **Batch API for the AI classification pass** (`src/services/ai/`,
      since 2026-10-04; CLAUDE.md's model table calls for it —
      "Batch API para el pase masivo"). `classifyPeriod()` currently
      calls the AI classifier per supplier, 5 at a time, within the
      request (outside the DB transaction). Correct, but not the 50%-cheaper/async path CLAUDE.md
      describes — worth it once a period's supplier count makes the
      synchronous pass noticeably slow.
- [ ] **Anonymous crowdsourced catalog** (ADR-007). Agreement across
      taxpayers on how to treat a supplier was never built; supplier
      *knowledge* is shared through `supplier_profiles` (ADR-017), but each
      taxpayer's decision is not.
- [ ] **RLS regression test.** It has been manually verified against the
      real database several times, but it hasn't been left as a
      reproducible artifact (`tests/rls/`, per
      `docs/guides/coding-guidelines.md`). Write one before touching
      `src/lib/db.ts` again.
- [ ] **Measure the classification step** with a real period and many new
      suppliers. If it doesn't fit in one HTTP request, pg-boss comes in
      ([ADR-011](docs/adr/011-two-step-ingestion-and-classification.md)).

## Pending normative verification

None of this gets resolved with code — it requires real SRI files,
checking the portal, or confirming an effective date:

- [ ] **Complete `docs/tax/sri-file-format.md`** with files that
      include credit notes, debit notes, and withholding vouchers.
- [ ] **Verify and load `tax_rates`.** The screen (`/admin/rates`) has
      existed since 2026-10-04 and won't let anything be saved without a
      source and verification date — the verification itself is still
      missing (`docs/tax/vat-rates.md`: no rate confirmed yet).
- [ ] **Decide where `NON_DEDUCTIBLE` purchases go.** The AI can now
      return it (and the screen has a "No deducible" tab), but
      `calculator.ts` counts only `CREDIT` and `COST_EXPENSE`: a
      `NON_DEDUCTIBLE` voucher currently appears in no result. Whether
      it counts as a cost is `[VERIFICAR]` in
      [`vat-calculation.md`](docs/tax/vat-calculation.md).
- [ ] **Verify with the portal** whether the proportionality factor and
      the totals are computed by the portal from what's entered ([`docs/tax/vat-calculation.md`](docs/tax/vat-calculation.md)
      → *Pending verification*). Includes what the portal expects when the
      factor's denominator is zero (the domain already blocks that case
      with an explicit reason; what's missing is whether the portal needs
      something typed in regardless).

## Out of MVP scope

### Taxes
- **Income Tax.** The personal-expense model has changed: it's now a
  **reduction** calculated on the basic family basket and dependents, with
  more categories than the original two in the initial definition.
  Requires full normative verification.
- **Withholdings.**
- **ATS.** Probably the biggest commercial hook after VAT: it's painful
  monthly work and the data model already contains almost everything
  needed.

### Product
- **Settlement and balances.** The month's settlement, credit balances
  carried from prior months, total due. These require either a carry-forward
  mechanism between periods or manual entry.
- **Fixed assets**: the SRI file doesn't distinguish them.
- **Semiannual VAT.** It's a different form; out of scope. A semiannual taxpayer can register, but the MVP doesn't generate their pre-filing.
- Firms with multiple users. The structure already supports this
  ([ADR-003](docs/adr/003-user-as-tenant-with-join-table.md));
  missing an invitation interface and permission management.
- Subscription billing and payment collection.
- Period-over-period comparison, to detect anomalous variations.
- Excel or PDF export of the draft.
- English. `next-intl` has been there from the start; `messages/en.json`
  is missing.

### Technical
- Ingestion of voucher XML, which does carry line-item detail. It will
  coexist with the TXT at a different precision
  ([ADR-008](docs/adr/008-totals-only-no-line-items.md)).
- Archiving policy for `classification_events`.
- Alert when a period uses an expired normative effective date.
- Advisory per-period lock to prevent concurrent classification.
