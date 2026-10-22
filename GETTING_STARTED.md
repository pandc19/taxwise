# Getting started

## Requirements

| Tool | Version |
|---|---|
| Node.js | 24.x |
| Docker | For local PostgreSQL |
| PostgreSQL | 18+ (via Docker) |

## 1. Database

The container is named `postgres18`. If it already exists, just start it:

```bash
docker start postgres18
```

If it doesn't exist yet, create it:

```bash
docker run -d \
  --name postgres18 \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:18-alpine
```

Create the `taxap` user and the `taxap_dev` database:

```bash
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
```

| Parameter | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| User | `taxap` |
| Password | `taxap_dev_password` |
| Database | `taxap_dev` |

> **The `taxap` user is not a superuser, and must never be.** PostgreSQL
> superusers bypass Row-Level Security unconditionally, even with
> `FORCE ROW LEVEL SECURITY`. A misconfigured deployment that uses the
> `postgres` user silently disables all isolation between users.
> See [ADR-004](docs/adr/004-per-user-rls-with-prisma.md).

Verify that it isn't one:

```bash
docker exec postgres18 psql -U taxap -d taxap_dev \
  -c "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
# must return: f
```

The `taxap` role has `CREATEDB` permission (Prisma needs it for the shadow
database during migrations) but is not a superuser.

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Generate the auth secret:

```bash
openssl rand -base64 32
```

`.env.local` ends up looking like this (not version-controlled):

```
DATABASE_URL="postgresql://taxap:taxap_dev_password@localhost:5432/taxap_dev?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<the secret generated above>"
AI_PROVIDER="claude"
ANTHROPIC_API_KEY=""
```

`AI_PROVIDER`/`ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` if `AI_PROVIDER=openai`)
are **optional**. Without a key for the selected provider (or with the
account's AI switched off), the system runs in no-AI mode: the user's own
rules and the match against what they say they buy for work still decide
what they can, and everything else goes to the review inbox. Nothing
breaks. See [ADR-007](docs/adr/007-no-ai-mode-and-shared-catalog.md) and
[ADR-017](docs/adr/017-supplier-knowledge-and-rules.md). The two providers
(`src/services/ai/`) implement the same `AiClassifier` interface, so
switching one for the other is just `AI_PROVIDER` -- no code change.

Which model answers is set by `*_BULK_MODEL`, `*_ESCALATION_MODEL` and
`*_PROFILE_MODEL` (`CLAUDE_` or `OPENAI_` prefix). Knowing *who a supplier
is* is world knowledge, asked once per RUC and shared by every taxpayer, so
it uses the strong model by default; a small model confused a steel supplier
with a computer shop.

If the AI call fails with *"This API key is not scoped to a workspace"*, set
`ANTHROPIC_WORKSPACE_ID` to your workspace id (or use a workspace-scoped key).

## 3. Dependencies and schema

```bash
npm install
npm run db:migrate
npm run db:seed
```

The seed (`prisma/seed.ts`) only loads the plans (`plans`) — needed so
`users.plan_code` has something to point to when registering an account.
**It does not load normative data** (VAT rates): any value
without a source and verification date is marked `[VERIFICAR]` and is not
loaded into the system (CLAUDE.md → "Normative values"). Those are loaded
manually once verified — see [`docs/tax/`](docs/tax/).

## 4. Start it up

```bash
npm run dev
```

http://localhost:3000 → redirects to `/es` (the only locale for now).

## 5. First run

Everything happens inside the application. The step-by-step guide for
people using the system, with what each screen does, is
[`docs/guides/user-guide.md`](docs/guides/user-guide.md). In short:
register and log in; create a taxpayer (fill in "Tu trabajo" — it is what
lets the system tell which purchases relate to the work); create a period;
then walk its four steps: ingestion, sales, reconciliation, pre-filing.

For what each Server Action does and why, see
[`docs/guides/code-flow.md`](docs/guides/code-flow.md). For errors during
setup, see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

## 6. Administration (optional)

To load a VAT rate you need an `ADMIN` account — normal registration always
creates `INDIVIDUAL` accounts.

Set `ADMIN_EMAIL` (and `ADMIN_PASSWORD`, only needed the first time) in
`.env.local`, then run the seed:

```bash
npm run db:seed
```

If `ADMIN_EMAIL` already exists (for example, the account you registered),
this promotes it to `ADMIN` without touching its password. If it doesn't
exist yet, it's created with `ADMIN_PASSWORD`. Either way it's safe to run
again — re-seeding never duplicates the account. Log in with that account
and the sidebar will show "Administración".

On `/admin/rates`, loading a rate requires its source and verification date;
none is loaded by default because none has been verified yet
(`docs/tax/vat-rates.md`).

## Database commands

| Command | What it does |
|---|---|
| `npm run db:migrate` | Applies pending migrations (`prisma migrate dev`) |
| `npm run db:seed` | Seeds the plans, and the `ADMIN_EMAIL` account if that env var is set (`prisma/seed.ts`) |
| `npm run db:reset` | Drops everything in `public` (tables, types, functions), deletes the locally stored uploads in `storage/`, and migrates + seeds again. Blocked if `NODE_ENV=production`. |

Direct database access, if needed:

```bash
# As the app's user
PGPASSWORD="taxap_dev_password" psql -h localhost -U taxap -d taxap_dev

# As superuser (for administrative tasks, never for the app)
docker exec postgres18 psql -U postgres -d taxap_dev

# Prisma Studio
npx prisma studio
```

## Test data

The SRI's `.txt` files are **never version-controlled** — they are real
tax data. Keep them anywhere you like: every `*.txt` is in `.gitignore`.

For the expected format, see
[`docs/tax/sri-file-format.md`](docs/tax/sri-file-format.md).

## Resetting from scratch

```bash
npm run db:reset
```

Manual equivalent if needed:

```bash
docker exec postgres18 psql -U postgres -c "DROP DATABASE taxap_dev;"
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
npm run db:migrate
npm run db:seed
```

To verify that RLS works and for common errors during setup or the
walkthrough, see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
