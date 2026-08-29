# Amber procurement challenge

## Video walkthrough

**[▶ Watch the 10-minute product and architecture walkthrough](recordings/procurement-challenge-walkthrough.mp4)**

The recording follows a real quotation from XLSX upload through catalog review,
two-sided OpenAI negotiation, deterministic recommendation, and purchase-order
issuance, with the relevant architecture and code shown alongside the UI.

A staff-engineer coding challenge that turns ambiguous supplier spreadsheets
into reviewable order intent, runs a bounded negotiation, explains the selected
offer, and issues an idempotent purchase order.

The product brief is [challenge.md](challenge.md).

## What is implemented

- parsing and evidence preservation for all four supplied XLSX files
- brand-scoped catalog matching with explicit review decisions
- OpenAI-backed, schema-validated commercial-note interpretation and
  history-aware negotiation between buyer and supplier agents
- adversarial supplier personas with challenge-exact opening terms, bounded
  concessions, capacity constraints, and durable two-sided transcripts
- AI-interpreted commercial intent with deterministic, previewed decision weights
- deterministic eligibility, scoring, Pareto analysis, sensitivity, and tie-breaks
- preview-confirm-issue purchase-order flow with a durable list/detail ledger,
  transaction, and idempotency gates
- a streaming, workspace-aware procurement copilot whose proposed corrections
  remain explicit buyer-confirmed actions
- Hono/OpenAPI API, pg-boss worker, shadcn/TanStack React workspace, PostgreSQL, and MinIO

The challenge deliberately uses one configured actor and brand. Broader
platform and enterprise-integration concerns are outside its evaluation scope.

## Architecture

```text
apps/web ───────┐
apps/api ───────┼──> bootstrap ──> concrete adapters
apps/worker ────┘          │
                           v
                      application ──> domain + decision
                           ^
                           │ ports
            parser / agents / storage / persistence
                                      │
                                      v
                                     db
```

The application package owns commands, queries, repository ports, read-model
ports, and transaction boundaries. Persistence implements those ports with
Drizzle. The `db` package owns only schema, client, and migrations. Apps know
only their bootstrap boundary and transport contracts; an architecture check
enforces those import directions.

## Run the complete application

The simplest path uses Docker Compose. It runs PostgreSQL, MinIO, database
migrations and catalog seeding, the Hono API, the background worker, and the
React application.

### Prerequisites

- Docker Desktop or another Docker Compose-compatible runtime
- an OpenAI API key for note interpretation, supplier negotiation, and the
  procurement copilot

### Start

1. Create the local environment file:

   ```sh
   cp .env.example .env
   ```

2. Open `.env` and set `OPENAI_API_KEY`. The remaining values are disposable
   local-development defaults.

3. Build and start the stack:

   ```sh
   docker compose up --build
   ```

4. Wait until the `web`, `api`, and `worker` services are running, then open
   [http://127.0.0.1:3000](http://127.0.0.1:3000).

5. Upload `quotation_3.xlsx`, select the appropriate parsed scenario, review
   uncertain catalog matches, confirm the interpreted buying policy, and start
   the supplier negotiation.

The API is exposed at `http://127.0.0.1:3001`; the MinIO console is available at
`http://127.0.0.1:9001`. Application data survives ordinary container restarts.
The UI's **Reset challenge** action clears the challenge data when a fresh run
is needed.

Stop the stack without deleting its volumes:

```sh
docker compose down
```

### Podman

Requires Node 24 and pnpm 10.12.4 on the host:

```sh
corepack enable
pnpm compose:up:podman
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000). Stop the Podman stack
with `pnpm compose:down:podman`.

## Run checks and browser tests

The credential-free verification path requires Node 24 and pnpm 10.12.4. It
uses an isolated in-memory API composition and the real workbook parser, so it
does not require OpenAI credentials or containers.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm e2e:install
pnpm e2e
```

`pnpm e2e` runs the complete browser journey with an isolated in-memory API
composition and the real parser. It verifies immediate buyer-message rendering,
streamed copilot output, explicit suggestion application, reload recovery,
two-sided negotiation evidence, purchase-order detail/history, reset semantics,
narrow viewports, and accessibility.

## Verification

```sh
pnpm check
pnpm openapi:generate
pnpm openapi:check
pnpm --filter @procurement/persistence test:postgres
pnpm e2e
```

Tests focus on business invariants, supplied-workbook behavior, provider
boundaries, transactions/idempotency, real PostgreSQL repositories, transport
contracts, and one complete browser journey. CI runs all of these gates on Node
24, including a clean PostgreSQL migration. See [TOOLING.md](TOOLING.md) for the
small set of repository gates.
