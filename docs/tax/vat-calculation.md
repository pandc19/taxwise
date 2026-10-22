# What the system calculates (monthly IVA)

taxap turns a month's vouchers into a few totals and a proportionality
factor. It does not know the SRI form's fields: results carry a stable key
and a plain-language name, and where each one is entered in the SRI portal
is the user's own step ([ADR-016](../adr/016-results-not-mapped-to-form-fields.md)).

**Source:** the rules below were checked against a real monthly IVA filing
receipt (August 2026) on 2026-09-20. The receipt itself is not stored in the
project. Normative values (rates) live in [`vat-rates.md`](vat-rates.md).

**The MVP covers only the monthly form, and only the basics of sales and
purchases.** It does not calculate the month's settlement, prior months'
credit balances, or the total due.

---

## Results

### Sales — from issued vouchers

| Result key | What it is | What feeds it |
|---|---|---|
| `SALES_TAXED` / `SALES_TAXED_VAT` | Local sales taxed at a rate other than zero: base and IVA charged | Vouchers with `IVA > 0` (automatic) |
| `SALES_ZERO_NO_CREDIT` | Local sales at 0% that do **not** carry the right to credit | Marked by the user |
| `SALES_ZERO_WITH_CREDIT` | Local sales at 0% that **do** carry the right to credit | Marked by the user |
| `EXPORT_GOODS` | Exports of goods | Marked by the user |
| `EXPORT_SERVICES` | Exports of services and/or rights | Marked by the user |
| `SALES_NON_OBJECT_EXEMPT` | Transfers not subject to, or exempt from, IVA | Marked by the user |

The issued-vouchers file does not say why a sale has `IVA = 0`, so the user
marks each one ([sales step](../guides/user-guide.md)). Net = gross minus
issued credit notes ([ADR-010](../adr/010-treatment-by-voucher-type.md)).

### Purchases — from received vouchers with `IVA > 0`

| Result key | What it is | What feeds it |
|---|---|---|
| `PURCHASES_WITH_CREDIT` / `…_VAT` | Base and IVA of purchases that give a right to credit | `iva_category = CREDIT` |
| `PURCHASES_NO_CREDIT` / `…_VAT` | Base and IVA of purchases related to the work whose IVA is not credit (it becomes cost or expense) | `iva_category = COST_EXPENSE` |
| `PURCHASES_ZERO_VAT` | Total of purchases with `IVA = 0` (informational) | Never classified; no effect on credit |

`NON_DEDUCTIBLE` purchases (not related to the taxpayer's work) appear in no
result. Which of `CREDIT` or `COST_EXPENSE` a related purchase gets is the
taxpayer's own setting ([ADR-017](../adr/017-supplier-knowledge-and-rules.md)).

### Factor and credit

| Result key | What it is |
|---|---|
| `PROPORTIONALITY_FACTOR` | Share of purchase IVA that can be used as credit |
| `CREDIT_APPLICABLE` | IVA of purchases **with** a right to credit × factor |
| `VAT_NOT_CREDITED` | The part of that IVA not counted as credit because of the factor |

The IVA of `COST_EXPENSE` purchases never counts as credit, at any factor.
It may be that the SRI portal calculates these three itself from what is
entered; if so they are a cross-check value `[VERIFICAR]`.

---

## The proportionality factor

```
factor = sales that give a right to credit / total sales
```

- **Count in the numerator:** sales at any non-zero rate, 0% sales **with**
  the right to credit, and exports (goods and services).
- **Do not count:** 0% sales without the right to credit, and non-object or
  exempt sales.
- Format: 4 decimal places (`1.0000`).

**Exports count.** A taxpayer whose sales are only exports of services has a
factor of **1.0000**. The factor is zero only if every sale falls in a
destination that does not enter the numerator.

> Earlier documents said sales with no IVA gave a zero factor. That was
> incorrect.

**Blocking:** the factor is not calculated while any `IVA = 0` sale has no
destination marked. A factor over unmarked sales would only look exact.

**Pending case:** with no sales in the period the denominator is zero. What
the system should offer then is not decided `[VERIFICAR]`.

---

## Decisions

- **Sales with `IVA = 0` are marked by the user**, one at a time or in bulk.
  There are no learned rules for them: the file carries no customer or
  description. Every mark is logged ([ADR-013](../adr/013-immutable-audit-log-and-period-lock.md)).
- **Purchases with `IVA = 0` get no per-voucher decision.** They do not
  affect credit; only an informational total is kept.
- **A purchase's classification is `CREDIT`, `COST_EXPENSE` or
  `NON_DEDUCTIBLE`.** There is no "direct vs. proratable" attribution; the
  factor handles proration.
- **Only the monthly form.** A semiannual taxpayer can be registered, but
  the MVP does not generate their pre-filing and says so.

## Not in the MVP

| Concept | Reason |
|---|---|
| Fixed assets | The file does not distinguish a fixed asset from another purchase; everything is a normal purchase and the user adjusts by hand. |
| Variable or 5% rates | Would need the rate derived from `IVA / subtotal`, which [ADR-008](../adr/008-totals-only-no-line-items.md) rules out. |
| Imports, rate-difference adjustments, intermediary reimbursements | Need detail the file does not carry. |
| Credit notes to offset next month | Edge case of ADR-010. |
| Settlement, prior months' credit balances, total due | Balances come from the previous filing, not from the vouchers. |
| Voucher counts and totals the portal sums itself | A consequence, not something to enter `[VERIFICAR]`. |
| ISD, VAT withholding agent, payments, interest, penalties | A different tax role, or things that happen after filing. |

### Two cases to revisit later

- **VAT withholdings applied to the taxpayer.** Received withholding
  vouchers could feed a result; ADR-010 treats them as "not applicable" for
  purchases, which is correct for credit, but needs a real file `[VERIFICAR]`.
- **Credit balances carried between months.** If settlement is ever
  covered, a carry-forward between periods or manual entry will be needed.

## Pending verification

- [ ] Whether the portal calculates the factor, the applicable credit and
      the not-credited IVA from the entered sales and purchases
- [ ] Whether the portal sums the totals itself
- [ ] Factor value when there are no sales (zero denominator)
- [ ] Criterion for purchases attributable only to exempt sales
- [ ] Whether received withholding vouchers feed any result
- [ ] How an exporter's credit interacts with a refund request (the same
      IVA cannot be both credit and a refund) — confirm with an accountant
