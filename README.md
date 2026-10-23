# Taxwise

Tax-calculation assistant for Ecuador (SRI). Speeds up preparing the VAT
filing from the voucher files that the taxpayer downloads from the SRI
portal.

> **Taxwise does not file tax returns or replace professional judgment.**
> It produces calculation drafts that must be reviewed and validated by the
> responsible party before being submitted to the SRI. See [ADR-014](docs/adr/014-assistive-character-and-disclaimers.md).

## Who it's for

| Profile | Role in the system | Taxpayers |
|---|---|---|
| Individual who handles their own accounting | `INDIVIDUAL` | 1 |
| Independent accountant or firm | `ACCOUNTANT` | N, depending on plan |

## What it does

1. **Ingestion** — upload of the SRI's `.txt` files for received and issued
   vouchers, with integrity validation and deduplication by access key.
2. **Classification** — a cascade (the user's rules → remembered AI answers
   → what the supplier sells vs. what the user buys for work → optional AI
   → manual review) that decides whether each purchase relates to the
   taxpayer's work; its IVA treatment follows the taxpayer's own setting.
3. **Reconciliation** — an inbox where the user approves, reassigns, or
   excludes whatever the system couldn't resolve with confidence. A
   decision can optionally become a rule for that supplier.
4. **Pre-filing** — totals of sales and of purchases that can count toward
   IVA credit, with a breakdown traceable down to the individual invoice.

## Status

Functional MVP for monthly VAT: registration, taxpayers (with a profile of
their work), file ingestion, purchase classification with AI help,
supplier rules, sales marking, result calculation, and period locking all
work end to end against a real database. See [`NEXT_STEPS.md`](NEXT_STEPS.md)
for the exact status and open items.

Income Tax, Withholdings, and ATS are accounted for in the data model but
are out of scope for the MVP.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| i18n | next-intl (`es` only for now) |
| Database | PostgreSQL 18+ (Docker locally) |
| Data access | Prisma 7 + `@prisma/adapter-pg` |
| VAT calculation | Pure domain in TypeScript/`Decimal.js` — no aggregation SQL |
| Isolation | Row-Level Security per user |
| Authentication | NextAuth v5 (credentials) + bcryptjs |
| AI | Claude or OpenAI with the user's own key, set in Settings; structured output; optional (no-AI mode) |

Not implemented yet (see [`NEXT_STEPS.md`](NEXT_STEPS.md)): the Batch API
pass for AI calls, observability (Sentry), and a deployment target.

## Documentation

| Document | Content |
|---|---|
| [`docs/guides/user-guide.md`](docs/guides/user-guide.md) | How to use the system, in simple words |
| [`GETTING_STARTED.md`](GETTING_STARTED.md) | Getting the project running locally, from zero |
| [`docs/guides/code-flow.md`](docs/guides/code-flow.md) | How the app works today, screen by screen |
| [`docs/data-model.md`](docs/data-model.md) | Commented schema |
| [`docs/adr/`](docs/adr/) | Architecture decisions and their rationale |
| [`docs/tax/`](docs/tax/) | Tax reference and SRI file format |
| [`docs/guides/coding-guidelines.md`](docs/guides/coding-guidelines.md) | Conventions for writing code here |
| [`CLAUDE.md`](CLAUDE.md) | Rules for AI assistants |
| [`NEXT_STEPS.md`](NEXT_STEPS.md) | Open items and pending decisions |
| [`CHANGELOG.md`](CHANGELOG.md) | Change history |
