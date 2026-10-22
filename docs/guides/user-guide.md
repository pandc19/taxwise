# Using taxap

taxap helps you prepare your monthly IVA (VAT) numbers for the SRI. You give
it the files you download from the SRI portal; it sorts your purchases,
adds everything up, and shows you the totals to copy into the SRI portal
yourself.

> **taxap does not file anything with the SRI, and it is not an
> accountant.** It prepares a draft. You check it, and you do the filing
> in the SRI portal. The screens are in Spanish; this guide shows the exact
> Spanish labels in "quotes", with what they mean.

---

## The idea in one minute

1. You tell taxap **who you are and what you do** (once).
2. Each month you **upload your SRI files**: the invoices you received
   (your purchases) and the ones you issued (your sales).
3. taxap works out **which purchases are related to your work**, with a
   little help from an AI service.
4. You **check what it wasn't sure about**.
5. taxap shows **the totals**. You copy them into the SRI portal.

---

## Before you start

- An account in taxap (register with an email and a password).
- Your **RUC** and the activities registered on it.
- Two files from the SRI portal for the month (tab-separated `.txt`):
  the **received** vouchers and the **issued** vouchers. If you only buy
  or only sell that month, one file is enough.

---

## 1. Create your taxpayer

Go to "Mis contribuyentes" → "+ Nuevo contribuyente".

**The basics:** RUC (13 digits), "Razón social" (your legal name), regime,
and "Periodicidad". taxap only prepares **monthly** IVA for now; other
frequencies can be registered but won't be calculated.

**"Actividades económicas":** copy them from your RUC, code and
description. Add one row per activity.

**"Tu trabajo" — the part that matters most.** The SRI files say who
issued each invoice but not what you bought. To guess whether a purchase is
for your work, taxap compares the supplier with what you tell it here. The
more concrete, the better:

| Field | What to put | Example |
|---|---|---|
| "¿Qué haces y para quién?" | One short line, up to 280 characters. **No names of people or personal data** — this text is sent to the AI service. | "Desarrollo software a medida para empresas del exterior" |
| "¿Cómo trabajas?" | Tick what applies: remote / from home, own premises, field work, own equipment. | Remoto / desde casa, Equipos propios |
| "¿Qué compras normalmente para trabajar?" | Tick everything you really buy for work: internet, mobile, computers, tools, office supplies, software, bank fees, transport, rent, utilities, professional services. | Internet, Telefonía móvil, Software |
| "IVA de las compras relacionadas con tu trabajo" | What happens to the IVA of purchases that are for your work: treat it as tax credit ("Considerarlo crédito tributario"), or as a cost or expense ("Tratarlo como costo o gasto"). | — |

If a supplier sells something you ticked (for example an internet provider
and you ticked "Internet"), taxap accepts it **without asking the AI**.
If you leave things unticked, it will not assume you buy them.

**The IVA setting is your own tax decision.** taxap does not make it for
you, and it can't tell you which one is better. Talk to an accountant if
you are unsure; you can change it later (see "Changing your mind").

---

## 2. Create a period

Open your taxpayer → "+ Nuevo período" → choose the year and month. A
period is one month. It starts as "Borrador" (draft).

Open the period. You see four cards, one per step; the same steps appear as
tabs at the top once you are inside.

---

## 3. Step 1 — "Ingesta" (upload your files)

Upload one file at a time with "Cargar y validar".

taxap checks every row: that the invoice belongs to you, that its date is
inside this month, and that nothing is duplicated. You see how many rows
were valid and which had errors. Uploading the same file twice does no harm
— invoices already loaded are skipped.

Mistake? The trash icon next to an uploaded file removes it **and the
invoices it brought**. It can't be undone.

When you are done, continue to the next step.

---

## 4. Step 2 — "Ventas emitidas" (your sales)

Sales that charged IVA are handled automatically.

Sales **without IVA** (0%) need your help, because the SRI file doesn't say
why there was no IVA. For each one, choose where it belongs:

- "0% sin derecho a crédito" / "0% con derecho a crédito"
- "Exportación de bienes" / "Exportación de servicios"
- "No objeto o exenta de IVA"

Select one or several, choose the destination in "Marcar seleccionadas
como", and confirm. Until every such sale is marked, taxap will not
calculate the **factor of proportionality** (the share of your purchase IVA
that can count as credit) — a number over unmarked sales would only look
exact.

If you only export services, the factor will be `1.0000`.

---

## 5. Step 3 — "Conciliación" (your purchases)

This is where taxap sorts your purchases. Only invoices **with IVA** are
sorted; the rest are shown in a tab for information.

Press **"Clasificar ahora"**. taxap groups the invoices by supplier and
decides each supplier in this order:

1. **A rule you made** for that supplier.
2. **An earlier answer from the AI** for the same supplier, as long as your
   activities and "Tu trabajo" haven't changed.
3. **Your own list:** the supplier sells something you ticked in "¿Qué
   compras normalmente para trabajar?".
4. **The AI**, which says whether purchases from that supplier are related
   to your work. If it isn't sure, it says so.
5. **You.** Whatever is left waits in "Pendientes".

### What the AI does (and doesn't)

The AI is asked two simple things, never about money:

- **"What is this supplier?"** — asked once per supplier and remembered for
  everyone. It sees only the supplier's RUC and name.
- **"Is this supplier related to this person's work?"** — it sees your
  activities and what you wrote in "Tu trabajo", **never your RUC or your
  name**.

It never decides whether something gives you tax credit; that comes from
your own setting. It can be wrong. A supplier it doesn't recognise, or one
that sells the same things to businesses and households alike (hardware
stores, general shops, fuel stations), is **never decided automatically**:
it waits for you.

If you don't want the AI at all, it can be turned off per account (there is
no screen for that yet) or by leaving out the provider key; everything else
still works and more invoices will wait for you.

### The tabs

| Tab | What is in it |
|---|---|
| "Sin clasificar" | Not looked at yet. |
| "Con crédito tributario" | Related to your work; the IVA counts as credit. |
| "Costo o gasto" | Related to your work; the IVA is a cost or expense, not credit. |
| "No deducible" | Not related to your work (groceries, restaurants, entertainment…). |
| "Pendientes" | taxap couldn't decide. **This is yours to review.** |
| "Sin IVA (informativo)" | Invoices with no IVA. Nothing to do. |

Hover over a tab for a short explanation.

### Understanding a row

Each classified row shows **who decided it**:

- **IA** — the AI.
- **Perfil** — your own "Tu trabajo" list matched the supplier.
- **Regla** — a rule for the supplier.
- **Manual** — you.

Click the small **info icon** next to the classification to see what taxap
knows about the supplier, and, if the AI answered, its confidence and its
reasoning. For suppliers waiting on you, it says why.

### Deciding by hand

Tick one or more rows, choose "Clasificar como" (Con crédito / Costo o gasto
/ No deducible) under "Acción masiva", and press "Confirmar".

- This changes **only the rows you ticked**. One supplier can sell both
  work and personal things, so one decision doesn't spread to the rest.
- To make it a **rule for that supplier**, tick **"Aplicar a todos los
  comprobantes de este proveedor"**. Use it only for suppliers that always
  sell the same kind of thing.
- Your manual decisions are never changed by a later "Reclasificar".

### Classifying again

| Button | What it does |
|---|---|
| "Clasificar ahora" / "Reintentar clasificación automática" | Only handles invoices still waiting. Anything already classified stays. |
| "Reclasificar todo" | Re-decides everything **except what you decided by hand**. Use it after changing your profile, your IVA setting, or when you suspect a wrong AI answer. |
| "Reclasificar automáticamente" | Re-decides just the rows you ticked. |

### Your rules: "Proveedores"

The store icon at the top of your taxpayer opens your supplier rules. You
see each one, whether it is yours ("Manual") or an AI answer taxap
remembers ("IA"), and you can change it ("Relacionado con mi trabajo" /
"No relacionado") or remove it with the trash icon. Changing or removing a
rule **does not touch invoices already classified**; use "Reclasificar
todo" for that.

If you change your economic activities, your own rules show "Por
reconfirmar" and stop applying until you press "Reconfirmar todas".

---

## 6. Step 4 — "Pre-declaración" (the totals)

The totals are calculated for you the first time you open this screen; press
**"Recalcular"** after any change.

| Block | What you see |
|---|---|
| "Ventas" | Your sales by kind, with the IVA you charged. |
| "Adquisiciones" | Purchases that give a right to credit, and purchases that don't (cost or expense), each with its **base** and its **IVA**; plus purchases with no IVA, for information. |
| "Factor de proporcionalidad" | The share of purchase IVA that can count as credit, and the resulting credit. |

Purchases still in "Pendientes" are **not** in these totals — review them
first.

**Copy the values into the SRI portal yourself.** taxap does not know the
SRI form's boxes, so it names each total in plain words.

When you have filed in the SRI, press **"Marcar como presentado en el
SRI"**. That only records that you did it, and **locks the month's invoices**
so nothing changes by accident. "Reabrir período" undoes it.

---

## Next month

Create the new period and repeat. Suppliers you already worked through are
recognised: your rules and the AI's remembered answers carry over, so far
fewer invoices wait for you.

## Changing your mind

| You change | What to do afterwards |
|---|---|
| "Tu trabajo" (description, setup, typical expenses) | Open the period → Conciliación → "Reclasificar todo". Suppliers are asked again with your new profile. |
| The IVA setting | Same: "Reclasificar todo". No new AI questions are needed. |
| Your economic activities | Check "Proveedores" and reconfirm your rules; then "Reclasificar todo". |

Months you already marked as presented should not be reclassified; reopen
them first.

---

## What taxap never does

- It never files or sends anything to the SRI.
- It never sends your RUC or your name to the AI.
- It never changes a classification without leaving a record (every change
  is logged with who or what made it).
- It never guesses a number: if it can't calculate something (for example
  the factor with unmarked sales), it says why instead of showing a figure.

## If something looks wrong

| What you see | Why, and what to do |
|---|---|
| Totals are all empty | Press "Recalcular". Nothing is counted until invoices are classified. |
| "Factor … No calculado" | Some sale without IVA isn't marked yet — go to "Ventas emitidas". |
| An invoice sits in "Pendientes" | taxap wasn't sure, or the supplier sells to both businesses and households. Decide it by hand. |
| The AI says it doesn't recognise a supplier | It won't guess. Decide by hand, optionally with the rule checkbox. |
| A wrong classification | Change it by hand. If many are wrong, check your "Tu trabajo" and press "Reclasificar todo". |
| One invoice changed but the supplier's others didn't | By design: a manual decision applies only to the rows you ticked. Use the rule checkbox if you want it for the whole supplier. |
| "Clasificar ahora" did nothing for classified invoices | It only handles waiting ones. Use "Reclasificar todo". |

## Words used here

| Word | Meaning |
|---|---|
| IVA | Value-added tax. |
| Crédito tributario | IVA paid on purchases that you can subtract from IVA you charged. |
| Costo o gasto | A business cost; its IVA is not credit. |
| Factor de proporcionalidad | How much of your purchase IVA can count as credit, based on your sales. |
| Período | One month. |
| Comprobante | An invoice or similar document. |
| Regla | A decision about a supplier that taxap reuses. |
