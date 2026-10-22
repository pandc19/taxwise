# Architecture Decision Records

Each file documents one decision: the context in which it was made, what was
decided, what is gained, what is lost, and what alternatives were discarded.

An ADR is not edited when the decision changes — a new one is written that
replaces it, and the old one is marked *Superseded by ADR-NNN*. The history is
the point.

| # | Decision | Status |
|---|---|---|
| [001](001-nextjs-monolith-with-domain-layer.md) | Next.js monolith with a pure domain layer | Accepted |
| [002](002-own-postgresql-instead-of-supabase.md) | Self-hosted PostgreSQL instead of Supabase | Accepted |
| [003](003-user-as-tenant-with-join-table.md) | The user is the tenant, with a join table | Accepted |
| [004](004-per-user-rls-with-prisma.md) | Row-Level Security per user with Prisma | Accepted |
| [005](005-classification-cascade.md) | Four-level classification cascade | Partially superseded by 017 |
| [006](006-rules-by-supplier-and-economic-activity.md) | Rules by supplier and economic activity | Partially superseded by 017 |
| [007](007-no-ai-mode-and-shared-catalog.md) | No-AI mode and shared catalog | Accepted |
| [008](008-totals-only-no-line-items.md) | Totals only, no line-item detail | Accepted |
| [009](009-access-key-as-deduplication-key.md) | Access key as the deduplication key | Accepted |
| [010](010-treatment-by-voucher-type.md) | Voucher-type allowlist | Accepted |
| [011](011-two-step-ingestion-and-classification.md) | Resumable two-step ingestion and classification | Accepted |
| [012](012-rates-and-fields-as-data-with-effective-dates.md) | Rates and fields as data with effective dates | Partially superseded by 016 (rates remain) |
| [013](013-immutable-audit-log-and-period-lock.md) | Immutable audit log and period lock | Accepted |
| [014](014-assistive-character-and-disclaimers.md) | The system's assistive character | Accepted |
| [015](015-form-definition-from-pdf.md) | Form definition imported from PDF | Superseded by 016 |
| [016](016-results-not-mapped-to-form-fields.md) | Results are not mapped to Form 104 fields | Accepted |
| [017](017-supplier-knowledge-and-rules.md) | Supplier knowledge and rules | Accepted |
