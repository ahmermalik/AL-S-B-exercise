# Asset Living month end close prototype

This project supports Scenario B of the Asset Living VP Business Operations and AI Enablement build exercise. The intended outcome is a manager review package that helps identify accounting exceptions, prepare supported commentary, and surface unresolved evidence before owner reporting is due.

Planning began on October 29, 2026. The local application and required local checks are complete: all four screens use authenticated server endpoints, SQLite, a durable preparation worker, versioned review cases and frozen reports. Run it at **http://127.0.0.1:3000** using the [local runbook](docs/local-runbook.md).

Production deployment configuration for the shared DigitalOcean droplet lives
in [`infra/deploy`](infra/deploy/README.md). Images are built in GitHub Actions,
runtime state stays on a persistent host directory, and the web/worker
containers have explicit memory limits. The deployed application is available
at **https://asset-living-demo.foresyte.xyz**.

## Start locally

Use Node 24 (the exact target is in `.node-version`) and pnpm 11.8.0. From the repository directory:

```sh
pnpm install --frozen-lockfile
cp -n .env.example .env.local
pnpm dev
```

For a new installation, set `OPENAI_API_KEY` in `.env.local` before starting to enable live drafting. The sample configuration selects `gpt-6.1-sol`. Local startup generates an authentication secret if it is empty, creates the two accounts below, and starts both the web application and preparation worker. Existing accounts, imports and review history are preserved.

Open **http://127.0.0.1:3000**. On a new installation, import the supplied Excel workbook in **Prepare review**, or place it at `data/source/close-pack.xlsx` before startup. The workbook is supplied separately. On the configured local installation, it is already imported; start with `pnpm dev` if the app is stopped. Keep an existing `.env.local` when restarting. OpenAI credentials and the working database remain gitignored.

Keep the terminal running while using the app. Press **Ctrl+C** there to stop both web and worker. If `pnpm dev` reports that port 3000 is already in use, an instance may already be running: open the URL, or stop that instance in its original terminal before restarting. The startup check runs before setup and avoids starting a second worker when the port is occupied.

## Walkthrough logins

These shared accounts are included for the public demonstration repository. Both use the same application, four screens and accounting records; available actions depend on the signed-in role.

| Role | Login ID | Password | Main responsibilities |
| --- | --- | --- | --- |
| Accounting manager | `manager@assetliving.com` | `CloseReview!2026` | Review evidence, request information, approve or return proposals, confirm resolution, and save reviewed packages. |
| Staff accountant | `accountant@assetliving.com` | `CloseReview!2026` | Add support, prepare or revise analysis, record correction execution, and check refreshed records. |

The agent performs initial preparation without a separate login. The staff accountant supplies missing source records and execution evidence; the manager reviews the work. Separate roles preserve attributable handoffs and prevent the staff accountant from approving their own correction. For the walkthrough, keep the manager in a normal browser window and the accountant in a private window.

The sample `LOCAL_SEED_PASSWORD` creates these credentials on a fresh database. Changing that setting does not reset passwords for existing accounts. Begin the Sunset Ridge walkthrough as the **manager**: open **Prepare review**, inspect the workbook and source notices, then choose **Start preparation** on a fresh import or **Run again** after a completed run. Preparation covers the whole workbook; select **Sunset Ridge** from the workspace afterward. See the [local runbook](docs/local-runbook.md#first-workflow) for the complete handoff.

## Reset the walkthrough

Click the account initials (**AM** or **JR**) → **Reset walkthrough** → confirm **Reset walkthrough**. Either account can reset the shared workspace. Cancel leaves all work in place.

Reset removes preparation runs, cases, added support, proposals, decisions, execution records, agent activity and saved packages. It restores the original workbook as a fresh import without automatically running preparation. Both logins, their sessions, appearance preferences and OpenAI configuration remain available. Browser summary drafts are cleared; other open windows reload when they detect the reset. Previous case/package links and outstanding requests cannot update the new workspace.

Afterward, open **Prepare review → Start preparation** to rehearse again. Reset is irreversible and applies to both accounts. The implementation is verified using an isolated database, never by clearing the working walkthrough during development.

## Implementation status

OpenAI Responses is working with the configured catalog identifier `gpt-6.1-sol`. Account model listing/retrieval succeeded, an actual Case review tool-loop revision returned HTTP 200 with two source references, and the live package summary returned HTTP 200 for Sunset Ridge's four cases. The latest summary was 42 words in two sentences without internal status IDs. The full worker run is verified: Submitted, 67/67 complete, no run error, with 16 live semantic drafts and 51 rule-only preparations. The earlier HTTP 401 invalid-key and HTTP 429 credit-exhaustion responses are recovery history, not current blockers. Azure remains a separate future deployment and is not authorized in the current local scope.

## Local verification

- TypeScript, ESLint, 51 unit tests, both browser workflows (accounting and shared reset), and the Linux production image build passed. Reset checks cover both roles, cancellation, stale requests, restored source, browser drafts and retained sessions. All four screens were checked on desktop and phone, with targeted dark-theme, 125% zoom, reduced-motion and keyboard/focus checks. Partial progress, phone package actions and dialog focus were corrected and rechecked.
- The earlier Linux image verified Node.js 24.22.2 and SQLite 3.53.4; the final Linux image rebuild passed. Authenticated container login, source counts, worker preparation and restart persistence passed; the earlier isolated container check retained one import and 67 cases. The current full worker run completed all 67 cases without an error, including 16 live AI drafts.
- Current source preparation yields 67 findings: 7 duplicate candidates, 10 coding reviews, 6 variance-commentary findings, 28 approval-evidence findings and 16 close findings. These are review findings, not confirmed losses or policy violations.
- Sunset Ridge has four findings, including its approval-evidence gap. Resolving one case leaves the others and the original close-source status independent.

The separate live evaluation identified a supplemental invoice-identity mismatch. Typed source-invoice support and approval/execution guards are now fixed; 42 unit tests and the full browser regression pass, including legacy-record safeguards. The fresh live evaluation passed 3/3 mechanical checks and separate Codex qualitative review; the final Linux image rebuild passed. The 67/67 original-source run remains verified. See the [evaluation finding](docs/implementation-plan.md#live-evaluation-finding-and-follow-up).

See the [runbook](docs/local-runbook.md) for startup, account setup, workflow, checks, provider recovery and local containers. It distinguishes injected-transport/browser tests from live provider verification.

## Project documentation

- [Decision log](docs/decisions.md) distinguishes user decisions from recommendations and open questions.
- [Local runbook](docs/local-runbook.md) starts the working application and explains the staff/manager workflow and recovery.
- [Product scope](docs/product-scope.md) records the audience, selected features, agent workflow, review boundaries, and demonstration.
- [Architecture](docs/architecture.md) records the selected stack, SQLite storage requirements, LLM integration and Azure delivery baseline.
- [Implementation plan and status](docs/implementation-plan.md) records the build contracts, completed local work and future deployment checks.
- [UI rules](docs/ui-guidelines.md) apply ui-craft to composition, concise copy, on-demand evidence and compact reports.
- [Showcase assessment](docs/showcase-assessment.md) evaluates role fit, engineering evidence, and the main risks to the demonstration.
- [Screens and workflow](docs/screens-and-workflow.md) preserves the agreed interface and complete review cycle.
- [Review package walkthrough](docs/screens/review-package.md) records the internal handoff, approved versus unresolved cases, versioned snapshots and inline summary.
- [Property management close research](docs/research/property-management-close.md) maps actual close activities, exports/APIs, and the supplied data to the proposed application scope.
- [Accounting correction routes](docs/research/accounting-correction-routes.md) distinguishes duplicate/coding investigation, AP corrections, conditional JE drafts, and evidence needed before resolving a case.

## Current implementation

| Topic | Current position |
| --- | --- |
| Exercise | Scenario B selected. |
| Database | Local `data/asset-living.sqlite` with immutable source archives and durable review history. Azure's selected future topology uses an attached persistent managed disk. |
| LLM | OpenAI Responses through the official SDK; configured `gpt-6.1-sol`. Account/model access and live Case review/package-summary responses verified; full worker preparation verified at 67/67 (16 live semantic drafts and 51 rule-only cases). Azure Gateway remains unconfigured. |
| Hosting | Local application implemented. Linux container login, preparation and restart-persistence checks passed. Azure VM/disk topology selected but not deployed. |
| Application stack | Installed and locked in `package.json` / `pnpm-lock.yaml`: Next.js 16.4.3, React 19.3.1, Node 24, Better Auth 1.7.14, better-sqlite3 13.0.3, Drizzle 0.45.4 and the selected TypeScript/UI/intake libraries. |
| Operating workflow | Four connected screens, manager/accountant server roles, persisted preparation, evidence/version gates, execution/check records and frozen HTML/CSV packages are implemented locally. Real accounting-system posting and owner-report delivery remain outside this application. |
| UI direction | Concise operational views, compact package preview, and source/audit details on demand. Apply ui-craft during each implementation slice. |
| Product presentation | Polished working-application language and behavior. No demo/simulated/preview-only labels in the interface; provenance remains in internal records and documentation. |
