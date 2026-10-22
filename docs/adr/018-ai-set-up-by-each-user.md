# ADR-018: AI is set up by each user

## Status
Accepted

## Date
2026-10-22

## Supersedes
In part [ADR-007](007-no-ai-mode-and-shared-catalog.md): the per-account
`users.ai_enabled` switch and the server-wide provider and key.

## Context

AI classification was configured on the server through environment
variables: `AI_PROVIDER`, the provider's API key, and the bulk, escalation
and profile models. That meant:

- the owner of the server paid for every user's classification;
- the key lived in a plain `.env` file, and the model could only change with
  a redeploy;
- `users.ai_enabled` was a switch with nothing behind it (it defaulted to
  true and no screen changed it), so "no-AI mode" really meant "the server
  has no key";
- three model variables per provider were more configuration than anyone
  uses -- in practice one model was wanted.

## Decision

**Each user sets up their own AI in a Settings screen**
(`/settings/ai`): the provider (Anthropic or OpenAI), their API key, an
Anthropic workspace id if the key needs one, and optionally a model. The
server holds no AI key and reads no AI setting from the environment.

- **No key means no AI.** That *is* the no-AI mode of ADR-007; there is no
  separate switch, and `users.ai_enabled` is dropped.
- **The key is stored encrypted** (AES-256-GCM, key from `ENCRYPTION_SECRET`,
  the user's id as authenticated data so a blob cannot be moved to another
  user). It is never returned or logged; only its last four characters are
  shown. If `ENCRYPTION_SECRET` is missing or changes, saved keys are
  unreadable and count as no key -- users add theirs again, nothing else is
  affected.
- **Settings are checked before they are saved**, with provider requests that
  cost nothing (list the models, retrieve the chosen model), so a typo shows
  up there and not at the first classification.
- **Two model settings, by what they are asked.**
  - *Normal AI work* (today, whether a supplier relates to a taxpayer's
    work) has two tiers in the code: a cheap **bulk** model answers first and
    a stronger **deep** one can answer again when the bulk answer is not
    confident enough. In Settings the user picks **one** model, which is set
    for both tiers; with none chosen each provider uses its own pair. The
    deeper search is **switched off** for now (`DEEP_RETRY_ENABLED` in
    `src/services/ai/models.ts`), so the system never searches deeper; the
    logic is there to be enabled later, together with a way to choose a deep
    model.
  - *Identifying a supplier* is world knowledge, asked once per RUC and
    shared by every taxpayer, so it has its **own model** setting, defaulting
    to the provider's strong model.
  - The screen says which default is used when a field is left empty.
- What is asked is always paid by whoever asked.

## Consequences

### Positive
- The server owner pays for nothing and holds no AI credentials to leak.
- A user can switch provider or model without anyone deploying anything.
- One setting instead of three per provider.

### Negative
- A new user has no AI until they get an API key and add it. Until then more
  invoices wait for their decision.
- `ENCRYPTION_SECRET` becomes a secret to keep: rotating it logs everyone out
  of their AI.
- Verifying a key calls the provider; there is no rate limit on that yet.

## Alternatives considered

**A server-wide key paid by the owner, billed through plans.** Rejected for
now: no billing exists, and the measured cost per user is small but not zero.

**Environment variables per deployment.** What it replaced; fine for one
operator, wrong for a product used by several people.
