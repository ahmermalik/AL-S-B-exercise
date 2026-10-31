# Asset Living month-end close prototype

A working Scenario B prototype for reviewing month-end accounting exceptions.
It imports a close workbook, runs deterministic and bounded AI-assisted checks,
coordinates staff/manager review, and freezes an auditable review package.

## Review the application

**Live application:** https://asset-living-demo.foresyte.xyz

| Role | Login | Password |
| --- | --- | --- |
| Accounting manager | `manager@assetliving.com` | `CloseReview!2026` |
| Staff accountant | `accountant@assetliving.com` | `CloseReview!2026` |

Use a normal window for the manager and a private window for the accountant to
exercise the handoff. This is a shared, resettable review environment; do not
upload confidential or production data. The supplied exercise workbook is not
stored in Git and must be imported through **Prepare review**. Live AI drafting
is currently disabled on the hosted demo; deterministic preparation and the
complete manual review workflow remain available.

Suggested review path:

1. Sign in as the manager and import the supplied workbook.
2. Start preparation, then open a property and one of its cases.
3. Request evidence as the manager and respond as the accountant.
4. Review the versioned proposal, execution evidence, and resolution gates.
5. Save a review package and inspect its frozen HTML/CSV output.

## What is implemented

- Four connected screens: preparation, close workspace, case review, and
  review package.
- Authenticated manager/accountant roles with server-side authorization.
- Deterministic duplicate, coding, variance, approval-evidence, and close
  checks before any model interpretation.
- A separate durable worker with leases, retries, cancellation, bounded tools,
  and version checks.
- Immutable source references, attributable evidence, explicit execution
  records, and frozen package snapshots.
- Optional OpenAI Responses integration for supported commentary and revision;
  provider failure preserves findings and manual review.
- Responsive desktop/phone UI, dark theme, keyboard/focus behavior, and
  print-ready reports.

## Architecture and key decisions

| Concern | Decision | Why |
| --- | --- | --- |
| Web and API | Next.js 16 standalone Node application | One typed deployment boundary for UI, auth, and server endpoints. |
| Background work | Separate Node worker | Long preparation runs survive requests and can recover expired leases. |
| Persistence | SQLite 3 in WAL mode through Drizzle and `better-sqlite3` | The workflow is single-host and modest-concurrency; local transactions keep the prototype simple and auditable. |
| Authentication | Better Auth email/password with manager/accountant roles | Preserves attributable handoffs without adding an identity platform to the exercise. |
| AI boundary | OpenAI Responses with application-owned evidence tools | The model can interpret and draft, but cannot run arbitrary SQL, post entries, send reports, or bypass review gates. |
| Reports | Materialized HTML/CSV package snapshots | Historical packages render from frozen content rather than mutable current cases. |
| Hosting | Two containers on the existing DigitalOcean droplet behind Caddy | Lowest incremental cost; Azure is not part of the current application runtime. |

The application deliberately does **not** post to an accounting system, approve
payments, deliver owner reports, or treat model output as evidence.

## Where state is stored

| Environment | Location |
| --- | --- |
| Local database and archives | `data/asset-living.sqlite` and adjacent `data/` content |
| Local configuration | `.env.local` |
| Production database, WAL, uploads, and manual backups | `/home/deploy/asset-living-close/data` on the droplet |
| Production configuration | `/home/deploy/asset-living-close/.env.production` with mode `600` |
| Container images | `ghcr.io/ahmermalik/asset-living-close` |

Runtime state, workbooks, databases, credentials, private keys, and deployment
secrets are ignored by Git and excluded from the Docker build context. GitHub
secret scanning and push protection are enabled.

## Run locally

Requirements: Node 24 and pnpm 11.8.0.

```sh
corepack enable
pnpm install --frozen-lockfile
cp -n .env.example .env.local
pnpm dev
```

Open http://127.0.0.1:3000 and use the credentials above. On a fresh database,
import the workbook through **Prepare review** or place it at
`data/source/close-pack.xlsx`. Add `OPENAI_API_KEY` to `.env.local` to enable
live drafting; deterministic preparation and manual review work without it.

Local Docker verification uses the same web/worker split:

```sh
docker compose up --build -d
docker compose logs -f web worker
```

## Verify the repository

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

The checked implementation has passed type checking, linting, unit tests, both
role-based browser workflows, shared-reset coverage, the production image
build, authenticated container smoke tests, and restart-persistence checks.
Live provider evaluation is separate because it consumes API credits.

## Deployment

Pushes to `main` build a `linux/amd64` image in GitHub Actions, push it to GHCR,
and deploy through SSH. The droplet runs:

- `asset-living-close-web` — Next.js UI and API routes, limited to 320 MiB.
- `asset-living-close-worker` — durable preparation worker, limited to 384 MiB.
- Shared Caddy — HTTPS and reverse proxy; the app binds no host port.

SQLite and source archives live outside the image on the persistent host bind
mount. See the [production runbook](infra/deploy/README.md) for the exact layout
and health checks.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/app/` | Screens and authenticated HTTP routes |
| `src/components/` | Shared application UI |
| `src/server/` | Auth, database, domain store, workbook import, and AI boundary |
| `src/worker.ts` | Durable preparation worker |
| `drizzle/` | Versioned SQLite migrations |
| `tests/` | Browser workflow and reset coverage |
| `infra/deploy/` | Production Compose, Caddy, environment template, and runbook |
| `.github/workflows/deploy.yml` | Build and deployment pipeline |

## Deeper documentation

- [Architecture](docs/architecture.md)
- [Decision log](docs/decisions.md)
- [Local runbook and complete walkthrough](docs/local-runbook.md)
- [Product scope](docs/product-scope.md)
- [Screens and workflow](docs/screens-and-workflow.md)
- [Implementation plan and verification history](docs/implementation-plan.md)
