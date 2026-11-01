# Local application

Implemented October 31, 2026. The four screens are connected to authenticated server endpoints, SQLite, a separate preparation worker, versioned cases and frozen report packages. The local workflow documented here is also packaged for the shared DigitalOcean deployment described in the [production runbook](../infra/deploy/README.md); Azure is not part of the application runtime.

## Start

Use Node 24 (project target in `.node-version`) and pnpm 11.8.0.

```sh
pnpm install --frozen-lockfile
cp -n .env.example .env.local
pnpm dev
```

An existing configured `.env.local` must be preserved; do not copy over it. Local startup generates `BETTER_AUTH_SECRET` if it is empty; containers require a configured secret. The sample `LOCAL_SEED_PASSWORD` matches the shared walkthrough accounts below; it can be changed before creating a new database. `pnpm dev` runs setup, then starts both Next.js and the worker. Setup creates missing accounts and loads the tracked `seed/close-pack.xlsx` only when the database has no selected import. It does not start preparation. Restarting preserves subsequent uploads and review history.

The local instance is at **http://127.0.0.1:3000**.

Keep the terminal open; **Ctrl+C** stops both the web server and worker. If port 3000 is already occupied, use the running application or stop it in its original terminal before running `pnpm dev` again. Startup detects the occupied port before setup and worker creation, so retrying does not start another worker.

| Account | Role |
| --- | --- |
| `manager@assetliving.com` | Manager review, approvals, resolution and package creation. |
| `accountant@assetliving.com` | Support records, proposed preparation and execution evidence. |

These are two roles within the same application and shared four-screen workflow. Staff records support and execution evidence; the manager reviews proposals, approves or returns them, confirms resolution and creates the reviewed package. The agent prepares findings without its own login. Use a normal browser window for the manager and a private window for the accountant to follow the handoff.

Both local review accounts and the public reviewer deployment use `CloseReview!2026`. It is an intentionally published demonstration credential, not a private production secret. Do not use the shared deployment for confidential data. New installations use `LOCAL_SEED_PASSWORD`; startup does not silently reset existing passwords.

The database is `data/asset-living.sqlite`; `.env.local`, runtime uploads, and imported source archives are gitignored. The intentionally public baseline is `seed/close-pack.xlsx`. Imported workbooks are hashed and archived under the data directory; resetting always returns to the first imported baseline.

## OpenAI

The selected provider is OpenAI Responses with configured `gpt-6.1-sol`. The [official model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol) documents Responses, function calling and structured outputs. The corrected identifier is also accessible in the authenticated account: model listing included it and retrieval returned HTTP 200. Keep `OPENAI_API_KEY` and `OPENAI_MODEL` in the ignored `.env.local`; never include keys in chat, tracked files, screenshots or reports.

Actual application checks passed: Case review's bounded tool-loop revision returned HTTP 200, cited two source records and retained the supported $2,214.16 grounds amount without inventing a JE; the package summary returned HTTP 200 for all four Sunset Ridge cases. Its latest version was 42 words in two sentences without internal status IDs. The full worker run is verified: Submitted, 67/67 complete, no run error, with 16 live semantic drafts and 51 rule-only preparations. These checks establish selected live integration behavior, not broad model quality or measured close-time savings.

Earlier HTTP 401 `invalid_api_key` and HTTP 429 `credit_balance_exhausted` responses were recovered and are not current blockers. If they recur, check project-key validity and account credit respectively. Restart `pnpm dev` after changing credentials so web and worker share the configuration; preserve the corrected catalog identifier. The application retains findings/manual review and never substitutes canned output for a failed live request.

Preparation uses code for duplicate matching, approval evidence and close tracking. AI drafting targets coding and variance cases; direct case revision and package summaries also use the live provider. A provider failure stops further model requests in that run. Retry the affected drafting after restoring provider access.

## Manager demo flow

Start with a fresh preparation after **Reset walkthrough** when demonstrating the new invoice context; rerunning preparation preserves existing cases and does not enrich older ones.

1. Open Workspace: expect 18 properties needing follow-up, six commentary discrepancies, nine threshold reviews and seven unusual-amount flags.
2. Select J. Ramirez in the matrix: 31 of 45 earlier steps are overdue across nine properties. Use the main Workspace navigation to return to all 38 active properties.
3. Inspect the seven amount flags, including the invoice below $10,000. Amount verification remains outstanding; the application has placed no payment hold.
4. Open the P114 variance case: its evidence includes four related AP rows, including the August-dated invoice. P107 Utilities has no related AP rows. AI can draft observations and questions without treating either pattern as an established cause.
5. Accept P114 wording, then return to Workspace. Five properties should remain in the missing-wording card and its drill-down. The original tracker and outstanding ledger support remain unchanged.
6. Save the internal review package with its remaining support gaps visible. The priorities briefing uses code-rendered facts; AI chooses their order and a compatible next action.

## First workflow

1. Sign in as the manager and open Prepare review. The demo workbook is already imported. Inspect the source notices, then use Start preparation or Run again after a completed run. A new run reuses the import's findings, preserves reviewed work and can regenerate eligible pending AI drafts. Preparation covers the whole workbook; select Sunset Ridge in the workspace afterward. A different workbook can be uploaded manually before preparation.
2. Open Sunset Ridge. The actual data has four findings: StaffBridge duplicate, Office Depot duplicate, grounds coding, and a Regional Manager approval-evidence gap. All remain in scope.
3. Request evidence for StaffBridge. In a second browser profile/private window, sign in as the accountant, open the same case, and Add support. Load support explicitly to populate the prepared exercise records, or enter the source details manually. Their internal provenance is retained without interface banners.
4. Prepare proposal from structured evidence, or use Revise with AI against the current case evidence. Review the source/version and remedy as manager, then approve the current proposal.
5. As accountant, Record execution. The correction reference and observed refreshed-record fields must be entered; expected ledger effects are not silently copied into observed source data. Check refreshed records; conflicting values keep the case open.
6. As manager, confirm this issue resolved. Other cases and original close-source statuses remain separate.
7. Open Review package for Sunset Ridge. Review the case register, optionally write or generate a short summary, acknowledge scope/open work, and save a reviewed snapshot. Preview/print that exact package or download CSV. Historical packages remain unchanged when cases later change.

The grounds case supports a conditional same-entity expense reclass; the office case supports rejection when its added source records establish unposted status. Capital-versus-expense candidates remain in Accounting treatment review pending policy/treatment evidence. Approval and close cases accept typed support records and manager evidence review without inventing a financial posting.

## Reset walkthrough

From either account, click the account initials, choose **Reset walkthrough**, and confirm. The shared workspace returns to the original workbook with no prepared cases or run. Use **Prepare review → Start preparation** to begin again. **Cancel** makes no changes.

The reset clears workflow tables, imported snapshots, case evidence/history/proposals/decisions, execution/check records, agent activity and reviewed packages, then reloads only the original source. Authentication accounts, sessions and migrations stay in place. The original workbook archive remains as the reload baseline; other generated archives referenced by cleared imports are removed when safe. Credentials and original files outside the archive are untouched.

Each reset creates a new workspace generation and import identity. Stale tabs, delayed uploads and agent responses cannot write old work back. Browser summary drafts are cleared on reset detection; separate browser profiles check again on focus and periodically. The reset applies to both users and cannot be undone.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

November 1 demo fixes passed typecheck, lint, 83 unit tests, both browser workflows and an isolated production build. Browser regressions cover returning from a matrix filter to all properties, retaining pagination through the amount dialog, and accepting P114 wording so both the commentary card and drill-down show five properties. A bounded live priorities request passed in one call with the grounded selection schema. Hosted preparation after reset completed 67/67; P114 has four related AP records and P107 has none. The browser tests use isolated databases. Earlier desktop/phone, dark-theme, 125% zoom, reduced-motion and keyboard/focus checks are recorded in the implementation history.

The browser tests use an isolated `data/e2e/workspace.sqlite` database and archive directory on port 3101 with provider credentials disabled; they never modify the working database or spend API credits. Stop the native development server before using the default test runner, because Next.js permits one development server per project output directory. Test setup resets only its own database. The financial workflow covers role denial, missing support, staff/manager transitions, refreshed evidence, package creation, AI-unavailable recovery, immutable exports and a phone viewport. The reset test covers confirmation/cancel, both role sessions, stale requests, browser drafts, shared-window reload and starting preparation again.

For an already-running isolated test server on port 3101, `PLAYWRIGHT_USE_RUNNING_SERVER=1 pnpm test:e2e` skips starting a second server. This mode is for an owned test database only; the reset test deliberately deletes its workflow records. Linux-container verification can use this mode while the working native app remains on port 3000.

Provider/worker unit tests use injected transports. They verify source/schema checks, authority constraints, bounded tools, quota errors, queue leases, cancellation, resume and rule-only versus AI work. These tests do not replace a successful live call.

## Live evaluation

`pnpm evaluate:ai` uses an isolated evaluation database and makes three bounded live agent invocations, consuming API credits. It is not part of the credential-free browser test or injected-transport unit suite. Corrected-run records are in `data/ai-evaluations/run-LqWEEE/` (`results.json` and `qualitative-review.json`); the original discovery remains under `run-op9gRR/`. Each invocation starts with a fresh isolated evaluation database.

The first qualitative review caught fixture invoice `INV-GND-01` disagreeing with the source invoice `INV-88242`; the LLM flagged the unsupported identity while the earlier deterministic baseline did not. Fixtures now use the actual invoice reference; financial support requires typed `sourceInvoiceReference`, and server approval/execution identity checks also guard legacy records. The hardening passed 42 unit tests, type/lint and the full browser regression, including support/approval/execution/resolution and frozen reports. The actual accountant form was checked empty and with Load support showing `INV-88242` on desktop/phone. The corrected live rerun passed 3/3 mechanical checks and separate Codex qualitative review of all three outputs. The 67/67 original-source preparation run remains verified; it did not use this later supplemental fixture. The 42-unit/browser results above are the latest hardening checks; the original discovery remains preserved as history. The three reviewed outputs withheld a JE for unsupported duplicate/policy-gap cases and kept the grounds $2,214.16 debit 6210 / credit 6410 conditional on manager approval, without implying execution. The grounds response distinguished the actual invoice from its AP transaction ID. These are bounded examples, not statistical model accuracy or human accounting sign-off.

## Local containers

`Dockerfile` and `compose.yaml` package the web application and worker for local Linux verification. Node.js 24.22.2 / SQLite 3.53.4, authenticated login/source counts, worker preparation and persistence after web restart were verified. The isolated check retained one import and 67 cases, with 51 rule-only preparations complete and model drafting partial at that time. The current full worker run later completed all 67 cases with no error, including 16 live semantic drafts; the earlier Linux image built successfully; the final Linux image rebuild passed. The local Compose binding is `127.0.0.1:3000`, so stop the native server before using it:

```sh
docker compose up --build -d
docker compose logs -f web worker
docker compose stop
```

The local runtime uses a Docker volume for the entire SQLite directory, including WAL/shared-memory files. The public demo workbook is packaged read-only in the image; runtime uploads and archives stay in the volume. Credentials are supplied through the ignored environment file, not built into the image. Do not remove the volume to restart or update the application. Production uses a host bind mount, shared Caddy, and CI-built GHCR image as documented in the [production runbook](../infra/deploy/README.md). Off-host backup and restore rehearsal remain operational follow-up work.
