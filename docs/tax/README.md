# Tax reference

This directory records **where the normative values the system uses come
from, and when they were verified**, so that a year from now it's
possible to tell whether they're still in effect.

This is not the regulation itself. It's the human-readable companion to
the `tax_rates` table, which is what the code actually queries
([ADR-012](../adr/012-rates-and-fields-as-data-with-effective-dates.md)).

| Document | Content |
|---|---|
| [`sri-file-format.md`](sri-file-format.md) | Structure of the portal's `.txt` files. **Verified against real files.** |
| [`vat-rates.md`](vat-rates.md) | History of rates with effective dates |
| [`vat-calculation.md`](vat-calculation.md) | What the system calculates: result keys, the proportionality factor, decisions, what is out of scope. Checked against a real filing receipt. The system does not use the SRI form's field codes ([ADR-016](../adr/016-results-not-mapped-to-form-fields.md)). |

## Rule for this directory

Every numeric value carries **source and verification date**. A value
without that is marked `[VERIFICAR]` and isn't loaded into the system's
tables until confirmed.

This is deliberate: it's better for data to be visibly missing than for
incorrect data to look verified.

## What isn't here

**Filing periodicity** is not a normative value derived by this system.
The SRI assigns it to each taxpayer and it's recorded on their RUC; the
user enters it when registering the taxpayer and it's editable. See
[ADR-012](../adr/012-rates-and-fields-as-data-with-effective-dates.md).
