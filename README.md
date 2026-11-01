# Asset Living month-end close prototype

A role-based workflow for finding accounting exceptions, collecting support,
reviewing proposed corrections, and freezing a month-end review package.

## Live demo

**https://asset-living-demo.foresyte.xyz**

| Role | Login | Password |
| --- | --- | --- |
| Accounting manager | `manager@assetliving.com` | `CloseReview!2026` |
| Staff accountant | `accountant@assetliving.com` | `CloseReview!2026` |

Use a normal window for the manager and a private window for the accountant.
The review path is:

1. Open **Workspace**: the attention strip shows properties needing close
   follow-up, commentary marked Complete without required explanations, and
   invoices flagged for amount verification. Managers also see an AI priorities
   briefing and an overdue-by-stage matrix; every count opens the related work.
2. Open **Prepare review**; the demo workbook is already loaded.
3. Start preparation and open a property case.
4. Request evidence as the manager; respond as the accountant.
5. Review the proposal, execution evidence, and resolution gates.
6. Save the frozen review package and export HTML or CSV.

This is a shared, resettable environment. Do not upload confidential data. The
tracked demo workbook and its contents are public. AI drafting runs when a
provider is configured; deterministic checks and manual review work without it.

## Tech stack

- **Language/runtime:** TypeScript, Node.js 24, pnpm.
- **Web application:** Next.js 16 App Router, React 19, Tailwind CSS 4.
- **API:** authenticated Next.js route handlers in the same deployable service.
- **Database:** SQLite in WAL mode, Drizzle ORM, `better-sqlite3`.
- **Authentication:** Better Auth with manager/accountant server-side roles.
- **Workbook intake:** ExcelJS and Zod.
- **Background processing:** separate durable Node worker with leases and
  version checks.
- **AI boundary:** OpenAI Responses with bounded, case-scoped evidence tools;
  optional at runtime.
- **Testing:** Vitest, Playwright, TypeScript, and ESLint.
- **Delivery:** Docker Compose, Caddy, GitHub Actions, GHCR, DigitalOcean.

## Architecture

- Next.js owns the UI, authentication, and HTTP API.
- A separate worker claims persisted preparation jobs; work is not tied to a
  browser request or tab.
- Web and worker share one local SQLite directory so the database, WAL files,
  source archives, and uploads remain on the same filesystem.
- Deterministic accounting checks run before model interpretation.
- The model can retrieve scoped evidence and draft wording; it cannot execute
  arbitrary SQL, post journal entries, approve payments, or send reports.
- Variance cases include the property's invoices for that category, so drafts
  describe what the AP register shows and frame timing or completeness as
  questions rather than causes.
- For manager priorities, AI selects source-linked facts and compatible next
  actions. Code renders the factual wording, counts, names, amounts and links;
  the model cannot introduce its own factual claims. Briefings are cached per
  review state and refreshed when review state changes.
- Cases use evidence/revision gates so stale requests or model responses cannot
  overwrite newer review work.
- Saved packages are materialized snapshots; historical exports do not change
  when current cases change.

Key tradeoff: SQLite and a single host keep the reviewer deployment simple and
cheap, but this is not a high-availability architecture.

## Run locally

```sh
corepack enable
pnpm install --frozen-lockfile
cp -n .env.example .env.local
pnpm dev
```

Open http://127.0.0.1:3000 and use the demo credentials above.

- The tracked `seed/close-pack.xlsx` loads automatically into an empty database;
  preparation still starts only when a user clicks **Start preparation**.
- A user can upload a different workbook through **Prepare review**. Resetting
  the walkthrough restores the original demo workbook without starting a run.
- Set `OPENAI_API_KEY` in `.env.local` to enable live drafting.
- Keep an existing `.env.local` when restarting; setup preserves existing
  accounts, imports, and review history.

Docker runs the same web/worker split:

```sh
docker compose up --build -d
docker compose logs -f web worker
```

## Storage and secrets

- Local state: `data/asset-living.sqlite` and adjacent `data/` archives.
- Local configuration: `.env.local`.
- Production state: `/home/deploy/asset-living-close/data` on the droplet.
- Production configuration:
  `/home/deploy/asset-living-close/.env.production` with mode `600`.
- Images: `ghcr.io/ahmermalik/asset-living-close`.
- GitHub deployment key: repository Actions secret, never committed.

Runtime databases, uploaded workbooks, credentials, private keys, and deployment
state are excluded from Git and the Docker build context. The only tracked
workbook is the intentionally public `seed/close-pack.xlsx`, which is packaged
in the image. GitHub secret scanning and push protection are enabled.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm evaluate:ai` is a separate live-provider evaluation and consumes API
credits. Normal unit and browser tests do not require provider credentials.

## Deployment

- Pushes to `main` build a `linux/amd64` image in GitHub Actions.
- Images are tagged with the commit SHA and pushed to GHCR.
- The deploy job connects over pinned-key SSH and recreates the two containers.
- After health and public checks pass, CI deletes every superseded local image
  for this application and asserts that exactly one remains. Old SHA tags stay
  in GHCR for rollback without consuming droplet disk.
- Shared Caddy terminates HTTPS; the application binds no host port.
- `asset-living-close-web` is limited to 320 MiB.
- `asset-living-close-worker` is limited to 384 MiB.
- SQLite, imported source archives, and uploads live on a persistent host bind
  mount. The public demo workbook is packaged read-only in the image.

See the [production runbook](infra/deploy/README.md) for exact paths and health
checks. Scheduled off-host backup and restore rehearsal remain follow-up work.

## Repository map

- `src/app/` — screens and authenticated routes.
- `src/components/` — shared UI.
- `src/server/` — auth, database, domain store, import, and AI boundary.
- `src/worker.ts` — durable preparation worker.
- `drizzle/` — SQLite migrations.
- `seed/close-pack.xlsx` — public demo workbook loaded on an empty database.
- `tests/` — browser workflow and reset coverage.
- `infra/deploy/` — production Compose, Caddy, environment template, runbook.
- `.github/workflows/deploy.yml` — build and deployment pipeline.

## Detailed docs

- [Architecture](docs/architecture.md)
- [Decision log](docs/decisions.md)
- [Local runbook](docs/local-runbook.md)
- [Product scope](docs/product-scope.md)
- [Screens and workflow](docs/screens-and-workflow.md)
- [Implementation and verification history](docs/implementation-plan.md)
