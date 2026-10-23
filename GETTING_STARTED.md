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

Create the `taxwise_app` user and the `taxwise` database:

```bash
./scripts/setup-db.sh postgres18 taxwise_app "taxwise_dev_password"
```

| Parameter | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| User | `taxwise_app` |
| Password | `taxwise_dev_password` |
| Database | `taxwise` |

> **The `taxwise_app` user is not a superuser, and must never be.** PostgreSQL
> superusers bypass Row-Level Security unconditionally, even with
> `FORCE ROW LEVEL SECURITY`. A misconfigured deployment that uses the
> `postgres` user silently disables all isolation between users.
> See [ADR-004](docs/adr/004-per-user-rls-with-prisma.md).

Verify that it isn't one:

```bash
docker exec postgres18 psql -U taxwise_app -d taxwise \
  -c "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
# must return: f
```

The `taxwise_app` role has `CREATEDB` permission (Prisma needs it for the shadow
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
DATABASE_URL="postgresql://taxwise_app:taxwise_dev_password@localhost:5432/taxwise?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<the secret generated above>"
ENCRYPTION_SECRET="<32 random bytes in base64, see below>"
```

`ENCRYPTION_SECRET` is **optional** but needed for any AI: generate it with
`openssl rand -base64 32`. The server holds **no AI key and reads no AI
setting from the environment** ([ADR-018](docs/adr/018-ai-set-up-by-each-user.md)):
each user opens "Inteligencia artificial" in the sidebar and enters their
own provider (Anthropic or OpenAI), API key, and optionally two models. The key
is stored encrypted with `ENCRYPTION_SECRET`; if that secret changes, saved
keys become unreadable and users add theirs again.

With no key set up the system runs in no-AI mode: the user's own rules and
the match against what they say they buy for work still decide what they
can, and everything else goes to the review inbox. Nothing breaks. See
[ADR-007](docs/adr/007-no-ai-mode-and-shared-catalog.md) and
[ADR-017](docs/adr/017-supplier-knowledge-and-rules.md).

There are two model settings (defaults in `src/services/ai/models.ts`, used
when left empty): one to *identify a supplier* — world knowledge, asked once
per RUC and shared by every taxpayer, so it defaults to a strong model (a
small one confused a steel supplier with a computer shop) — and one model for
*the rest of the AI's work*, which the code runs as a cheap "bulk" tier and a
stronger "deep" tier (one chosen model is set for both). The deeper retry is
switched off for now (`DEEP_RETRY_ENABLED`).

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
PGPASSWORD="taxwise_dev_password" psql -h localhost -U taxwise_app -d taxwise

# As superuser (for administrative tasks, never for the app)
docker exec postgres18 psql -U postgres -d taxwise

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
docker exec postgres18 psql -U postgres -c "DROP DATABASE taxwise;"
./scripts/setup-db.sh postgres18 taxwise_app "taxwise_dev_password"
npm run db:migrate
npm run db:seed
```

To verify that RLS works and for common errors during setup or the
walkthrough, see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
