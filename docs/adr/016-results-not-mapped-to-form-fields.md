# ADR-016: Results are not mapped to Form 104 fields

## Status
Accepted

## Date
2026-10-22

## Supersedes
[ADR-015](015-form-definition-from-pdf.md), and the form-field
half of [ADR-012](012-rates-and-fields-as-data-with-effective-dates.md).

## Context

[ADR-015](015-form-definition-from-pdf.md) had the system know
the whole Form 104: an admin imported the PDF, the system stored its field
catalog, and every result was related to a field (`result_mappings`) so the
user could be told "enter this amount in field N".

That machinery was never finished (the mapping was not computed) and it
pulled the product toward something it should not be: a tool that knows
which form cell each number belongs to. The people using Taxwise do not have
an accountant to check that mapping, and a correct value next to the wrong
field is the main risk ADR-015 itself identified.

What users actually need from Taxwise is smaller: **know which purchases they
can consider for IVA credit.**

## Decision

**The system does not know Form 104's fields.** No field catalog, no
`result_mappings`, no PDF import, no admin form screens. The domain keeps
producing results under stable keys (`PURCHASES_WITH_CREDIT`,
`PROPORTIONALITY_FACTOR`...) and the screens show those, in plain language.
Where the user enters them in the SRI portal is their own step.

What stays from ADR-012: rates as data with effective dates, looked up by
the date of the event (`tax_rates`, `/admin/rates`).

Removed: `form_versions`, `form_fields`, `result_mappings`,
`tax_periods.form_version_id`, the PDF extractor and the `pdf-parse`
dependency.

## Consequences

### Positive
- Far less to build, test and keep correct; nothing in the product can put
  a number next to the wrong field.
- No document with personal data (the form PDF) is ever handled.

### Negative
- The pre-declaration screen no longer says which form field a total
  belongs to; the user maps it themselves.
- Supporting another form later (e.g. the semiannual one) would be a new
  decision, not a configuration.

## Alternatives considered

**Finish ADR-015.** Discarded: it is the most work for the least value to
users without an accountant, and its failure mode is a silently wrong field.

**Hardcode the field numbers.** Discarded for the reason ADR-012 gave:
the SRI can change the form.
