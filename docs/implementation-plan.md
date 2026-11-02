# Implementation plan and status

Updated November 1, 2026. The original pre-build plan below is retained as the implementation contract. Under D022, the connected application was implemented; D029 records the later DigitalOcean reviewer deployment. All four screens, authenticated manager/accountant roles, SQLite preparation jobs, source-linked case review, and frozen reports are live at `asset-living-demo.foresyte.xyz`. Startup and the current workflow are in the [local runbook](local-runbook.md); production operations are in the [deployment runbook](../infra/deploy/README.md).

Local follow-up under D032, November 1: saving changed support now prepares a current rules proposal atomically, AI draft counters are collapsed, and Preparation displays a persistent current-workbook receipt. Prior proposal versions, approval boundaries, execution checks and immutable packages remain in place. The unposted-invoice ledger-form requirement is documented as a known limitation. These changes were deployed in commit 0bf41ee; the GitHub build and deployment completed successfully.

Verification for D032: TypeScript, ESLint, all 88 unit tests, both isolated browser workflows and an isolated production build passed. Browser coverage includes receipt absence before preparation, partial drafting, receipt persistence after reload/navigation, phone width, keyboard disclosure, automatic support preparation, one-click proposal comparison, manager/accountant permissions, correction verification, resets and frozen exports. Desktop and phone receipt captures were visually inspected. Verification used separate temporary source/dependency copies and owned databases; the running application and its database were preserved. The production build's temporary database needed serial WAL initialization before parallel page collection. No live provider call or hosted reset was required for this change.

## Current status

| Area | Verified state / remaining work |
| --- | --- |
| Local application | Runs at `http://127.0.0.1:3000`; all four screens use server endpoints and durable records. |
| Source preparation | Full worker run Submitted at 67/67, no run error: 16 live semantic drafts and 51 rule-only preparations. 67 findings: 7 duplicate candidates, 10 coding reviews, 6 variance-commentary findings, 28 approval-evidence findings and 16 close findings. Sunset Ridge has four findings, including its approval-evidence gap. |
| Core checks | TypeScript, ESLint, 42 unit tests, the full browser workflow and native Next.js production build passed. Browser/injected-provider tests do not establish live AI success. |
| Linux containers | Node.js 24.22.2 and embedded SQLite 3.53.4 checked. Authenticated login, source counts, worker preparation and persistence after web restart verified. One import and 67 cases survived; 51 rule-only preparations completed in that earlier isolated check; the current full worker run subsequently completed all 67 cases, including live semantic drafting. Only verification containers/volume were removed. The final post-hardening Linux image rebuild also passed. |
| Live provider | OpenAI Responses verified with configured `gpt-6.1-sol`: authenticated account/model retrieval, actual Case review tool-loop revision and four-case package summary returned HTTP 200. Full worker preparation passed at 67/67 with no run error, including 16 live semantic drafts and 51 rule-only cases; earlier 401/429 responses are recovery history. |
| Deployment | GitHub Actions builds and deploys web/worker to the shared DigitalOcean droplet. Public HTTPS, persistent host storage, reviewer credentials, and authenticated smoke tests passed. Scheduled off-host backup and restore/reboot rehearsal remain open. |

The contracts and exit criteria below remain useful for ongoing changes. The local workflow is ready for review: all four screens passed desktop/phone checks with targeted dark-theme, 125% zoom, reduced-motion and keyboard/focus checks. Partial progress, phone package action visibility and dialog focus were corrected and rechecked. The separate small labelled AI evaluation exposed the support-identity gap recorded below. Fixture/reference hardening, 42 unit tests and the full browser regression now pass; the fresh three-case live evaluation passed its mechanical checks and separate Codex qualitative review. No broad accuracy or close-time claim is inferred from selected successful cases.

The owner's subsequent direction D020/D021 is the presentation contract: a polished working-product experience with normal operational language, no demo/simulation/harness labels, and fixture provenance retained in internal records/documentation. Apply this across all four screens, sources, history and reports. The [UI rules](ui-guidelines.md) define the interaction and visual acceptance criteria.

## Outcome and scope

Build a useful Property Accounting Manager/staff accountant workflow for Scenario B: import the supplied September close pack, prepare a review across its applicable records, investigate source-linked exceptions, review supported corrections/commentary, and create a concise internal handoff containing unresolved work.

Agent-led preparation and manager review are selected. Staff accountants supply or verify missing support and record authorized source-system execution. The application prepares workpapers and records evidence; actual posting, payment release/holds, budget transfers, external messages, and owner-report delivery are outside this build. The two README policies remain the only employer-supplied approval/commentary rules.

Use Sunset Ridge as the primary walkthrough. Retain Campus Edge as a useful commentary/missing-evidence case if the core path is complete; additional showcase examples must not delay the working flow. Do not reuse Howard Hughes proprietary code or records.

## Live evaluation finding and follow-up

The separate three-case live evaluation found a real support-identity gap: for the grounds case, the model flagged fixture invoice `INV-GND-01` as unsupported because the original workbook invoice is `INV-88242`. The earlier structured baseline reported no missing evidence despite that mismatch. This is an observed LLM finding beyond the passing mechanical checks, not an accuracy score or a claim that the model certifies accounting correctness.

Follow-up is implemented and verified: fixtures use the source invoice reference, financial support requires typed `sourceInvoiceReference`, and server approval/execution checks enforce matching current-source identity. Legacy support or approval records cannot bypass these checks. The latest 42 unit tests (12 domain, 28 provider/worker, 2 report), type/lint and full browser workflow passed, including the new financial-support field and approval/execution/resolution/frozen-package path. The actual accountant form was checked empty and after Load support populated `INV-88242`, on desktop and phone. The fresh live evaluation passed 3/3 mechanical checks, with a separate Codex qualitative review of all three outputs. The original-source preparation run remains verified at 67/67; this finding concerns later supplemental support and does not invalidate that run's completion.

The corrected live evaluation is recorded under `data/ai-evaluations/run-LqWEEE/` (`results.json` and `qualitative-review.json`). All three mechanical checks passed, and a separate Codex qualitative review read all outputs: the unsupported duplicate retained its missing evidence and produced no JE; grounds distinguished invoice `INV-88242` from AP transaction `SR-GND-01`, proposed the supported $2,214.16 debit to 6210 / credit to 6410 with manager approval still required, and did not imply execution; the capital-versus-expense case retained its policy gap and produced no JE. This is a bounded three-case result, not statistical accuracy or human accounting sign-off.

Original discovery records remain under `data/ai-evaluations/run-op9gRR/`. The command `pnpm evaluate:ai` uses a fresh isolated evaluation database and makes three bounded live agent invocations, consuming API credits. It is separate from the offline/injected-transport test suite.

## Selected stack

| Layer | Build baseline | Purpose |
| --- | --- | --- |
| Runtime and dependencies | Node.js 24 LTS; pnpm with a committed lockfile | One JavaScript runtime for web and worker. Use supported patched releases. |
| Application | Next.js 16 App Router, compatible React 19 release, strict TypeScript | One project containing pages and Node-runtime server endpoints. |
| UI | Tailwind CSS 4, selected shadcn/ui primitives, Lucide icons | Small shared vocabulary for tables, forms, buttons, dialogs and status. Apply ui-craft during every slice. |
| Database | SQLite, better-sqlite3 13.x, stable Drizzle ORM 0.45.x and Drizzle Kit migrations | Typed schema, explicit migrations, local persistent review state. Avoid the Drizzle 1.0 prerelease installation path. |
| Import and validation | ExcelJS; Zod | Workbook parsing, boundary validation, typed evidence/model output contracts. |
| Jobs and agent | Separate TypeScript/Node worker, SQLite job records, a bounded application-controlled tool loop | Preparation survives request completion, browser refresh, retries and worker restart. |
| Model integration | Official OpenAI JavaScript SDK and Responses API, using the user's configured model | Selected local provider. Account access and selected live application results verified; full worker preparation verified at 67/67. Azure AI Gateway remains a future capability-checked alternative. |
| Demo authentication | Better Auth with SQLite/Drizzle, two seeded accounts and server-side manager/accountant permissions | Real session identity and role checks. No public signup, user-management console, email delivery or SSO in the first build. |
| Reports | Print-ready HTML, browser Print/Save as PDF, case CSV | A compact report without a server-side browser/PDF service. Full source manifest stays in Audit details. |
| Verification | Vitest, Playwright, TypeScript and ESLint | Accounting/state contracts, workflow integration, rendered interactions, and build checks. |
| Delivery | GitHub Actions, GHCR, shared DigitalOcean droplet, Caddy HTTPS, and persistent host bind mount | Public route, both reviewer logins, container health, existing-service isolation, and restart persistence passed. Off-host backup/restore rehearsal remains open. |

Installed package versions are recorded in `package.json` and `pnpm-lock.yaml`, including Next.js 16.4.3, React 19.3.1, Better Auth/adapter 1.7.14, better-sqlite3 13.0.3, Drizzle 0.45.4 and OpenAI SDK 7.47.0. The checked Linux runtime is Node 24.22.2 with SQLite 3.53.4. Node 24 remains the selected supported baseline; release image digests are deployment work.

## Shared implementation contracts

Keep UI components independent of accounting decisions. One domain owner implements case transitions used by the web endpoints and worker; server authority is not replaced by client-side disabled buttons.

- **Money:** store integer cents; compute variance and strict policy thresholds in code. Preserve source precision and handle zero/missing budgets explicitly.
- **Sources:** retain workbook hash, import identity, raw rows, sheet/range, policy version and scenario clock. New support has an author, period, source type, immutable content/version and demonstration provenance where applicable.
- **Cases:** separate preparation, evidence sufficiency, proposal review, execution and resolution. Do not collapse these into one generic Approved status.
- **Versions:** a decision binds to a proposal and evidence version. Use expected-version checks on mutations so stale tabs, repeated requests and late model responses cannot overwrite newer work.
- **Correction routes:** distinguish export duplicates, unposted invoices, posted AP bills, paid items and coding reclassifications. Missing posting/payment/period/authority evidence produces a request, not an executable JE.
- **Packages:** freeze scope, included cases, case/evidence/proposal versions, optional accepted wording, open actions and reviewer. Store materialized package content and its referenced immutable records; never rebuild a historical package from mutable current cases.
- **Idempotency:** imports, runs, jobs, evidence additions and manager submissions have deliberate reuse/conflict behavior. Retrying a job cannot create duplicate financial decisions.
- **Model failures:** retain deterministic findings, support and earlier drafts. Invalid schema, unknown source IDs, scope violations and unsupported numeric fields block publishing the affected model result. Schema validity is not proof of a causal explanation.

Suggested persistent groups: auth/session records; imports/source records; properties/invoices/variance/close rows; runs/jobs; cases/findings; evidence versions; proposals/drafts; decisions; execution/check records; package snapshots. Keep code modules aligned with these responsibilities without adding a generic platform or dual database abstraction.

## Screen-by-screen build contract

### 1. Close workspace

**Task:** identify which properties need intervention and the next responsible action.

- Property-by-eight-step close view using B4 source-reported statuses, responsible accountants, due business days and property scope.
- Case counts and specific blockers/evidence conflicts; select a property/step to inspect the relevant issues and enter Case review.
- Preparation and Review package actions keep the selected period/snapshot context.
- A short contextual handoff may summarize supported blockers. No AI health score, invented dependencies or certification of a bank/AR reconciliation.
- Apply ui-craft: one header for period/source, a compact property table, and selected-property details. Keep technical preparation logs out of the main workspace.

**Done when:** all active properties can be reached; Late, Due today, Not due and reported Complete remain distinct; conflicting completion evidence is visible without rewriting B4; selecting a case opens the correct property/period/version context.

### 2. Preparation

**Task:** import the pack and run preparation with honest progress and recovery.

- Accept the expected workbook, validate B0–B4 and policy context, retain the immutable source, and show blocking errors separately from warnings.
- Run reproducible duplicate/variance/approval-evidence/close checks across all applicable rows. Group shared gaps rather than create a repetitive decision queue.
- Persist Importing → Checking → Investigating → Drafting → Validating → Submitted stages, with cancellation, bounded retry and recovery.
- One Node worker claims jobs atomically with a lease/heartbeat. Recheck job ownership before writes; cancellation and stale-version checks apply to late model responses.
- Use simple status polling while a run is active. This prototype does not need WebSockets or an additional messaging service.
- Apply ui-craft: show source, scope, current stage and actionable errors. Expand detailed activity only when requested; keep substantive long-running progress visible.

**Done when:** reimport/retry behavior is predictable; a browser refresh or worker restart preserves work; model failure leaves calculated findings usable and affected drafting incomplete; no unsupplied document is reported validated.

### 3. Case review

**Task:** turn a finding into a supported disposition or a precise follow-up.

- Coordinated evidence, Proposed correction/analysis, and next-action areas. Preserve the accepted Sunset Ridge workflow while shortening repeated narration and metadata.
- Internal requests; attributable staff responses; source records distinct from attestation; stable evidence versions; agent revisions and version comparison.
- Manager return/dismiss/approve actions within the configured demo authority. Commentary wording acceptance remains distinct from support sufficiency.
- Authorized staff records an external correction reference and refreshed affected records. Code checks identity, amount, route and version consistency; the manager confirms supported issue resolution.
- Include the three Sunset Ridge branches: conditional AP reversal, conditional same-entity expense reclass JE, and unposted intake rejection. Preserve added policy/support/execution fixture provenance internally; use normal operational labels in the product.
- Apply ui-craft: show only the currently relevant actor/action. Keep necessary uncertainty and approval-versus-execution state visible; move history and full source records to detail views.

**Done when:** missing evidence blocks the appropriate correction; new support makes old approval historical; a returned proposal has a real revision/evidence path; mismatched execution cannot resolve a case; resolving one issue leaves other issues and property close independent.

### 4. Review package

**Task:** review outcomes and hand off outstanding work in a concise, versioned package.

- One case/action register distinguishing resolved, approved awaiting execution, execution awaiting verification, and evidence outstanding.
- An optional short source-linked summary with contextual AI revision, manager edit and wording review.
- Manager acknowledgement covers scope and all open issues. Open issues do not prevent an internal handoff and cannot be omitted from it.
- Save an immutable package; preview/print/export that exact version; keep newer case activity separate from historical contents.
- Open the report in a dedicated reading view with Back to review. Do not append a second copy of the register underneath the editing screen.
- Apply ui-craft: short header, optional concise summary, one action table. Do not repeat the register as an outstanding-work appendix. Keep full source manifests in Audit details, outside the default report.

**Done when:** an approved unexecuted correction never appears corrected; evidence gaps retain an owner/next action; new activity invalidates the current draft's applicable review/wording; old reports remain unchanged; an unavailable LLM still permits manual wording or a structured-only package.

## Live LLM implementation

Use one small provider boundary and one bounded case-investigation loop. Permitted tools retrieve property/COA/invoice/variance/close/evidence records for the current snapshot and case. The model proposes a typed draft or evidence request; application code validates and persists it. No arbitrary SQL, shell, payment, posting or message-sending tool is exposed.

Begin with configurable limits: at most six tool calls and one schema-repair attempt per case, explicit timeout/output limits, and bounded job retries. Log the actual model/provider, prompt version, source versions, tool arguments/results needed for audit, latency and returned usage. Do not log secrets or claim cost savings from tokens alone.

The important demonstration is interpretation and revision from varied descriptions and attributable support. A normalized invoice-number match remains deterministic. A package summary is useful synthesis, not the only justification for the LLM.

OpenAI Responses is implemented and selected in D023. The corrected `gpt-6.1-sol` identifier is documented for the required capabilities and accessible in the authenticated account. Actual application checks returned HTTP 200 for a source-cited Case review tool loop and a package summary across Sunset Ridge's four cases. The full worker run is verified: Submitted, 67/67 complete, no run error, with 16 live semantic drafts and 51 rule-only preparations. These selected successful examples do not establish broad model quality or measured close-time savings. Earlier 401/429 responses are recovery history. Keep the corrected configuration; Gateway remains a future capability-checked alternative.

Fixtures and live integration remain distinct in configuration, metadata and documentation. Do not add demo/simulation labels to product screens. A live-mode model outage never silently substitutes a successful canned answer. Synthetic supplemental sources must retain their internal origin rather than become employer-supplied facts after export.

## Implementation order and remaining qualification

Slices 1–5 are implemented and verified, including the full 67/67 preparation run, 16 live semantic drafts, selected Case review/package-summary calls, the Linux container workflow, and bounded UI checks. The separate live evaluation exposed a support-identity gap; its fixture/typed-reference/server-guard correction and regression/UI rerun now pass. The fresh live evaluation passed 3/3 mechanical checks and separate Codex qualitative review. Slice 6 was completed using the existing DigitalOcean droplet instead of the earlier Azure plan; scheduled off-host backup and restore/reboot rehearsal remain open.

| Slice | Deliverable | Exit check |
| --- | --- | --- |
| 1. Foundation | Dependency lock, app shell, shared UI primitives, auth, migrations, integer-money/source/version contracts | Clean build/type/lint; Linux container and native SQLite driver load; manager/accountant server permissions; actual embedded SQLite version verified. |
| 2. Import and deterministic preparation | Workbook storage/parsing, checks, persisted worker/jobs, basic Screens 1–2 | Source counts/references reconcile; strict thresholds and candidate grouping pass labelled checks; interrupted work resumes. |
| 3. Investigation and Case review | Live provider smoke check, bounded evidence tools, Screen 3, staff/manager workflow | One Sunset Ridge case reaches supported resolution end to end; other branches and returned/missing/conflicting support remain correct. |
| 4. Package and export | Screen 4, compact report, immutable package, print view and CSV | Open issues retained, approved/executed/resolved distinguished, historical export stable, no manifest in default report. |
| 5. Evaluation and UI completion | Remaining source coverage, labelled AI examples, all-screen ui-craft pass, responsive/error/recovery states | Meaningful automated checks plus settled desktop/phone/light/dark/enlarged-text/keyboard/reduced-motion inspection. Record actual findings, false positives, unsupported claims and review burden. |
| 6. Deployment and interview handoff | Production Compose, GitHub Actions/GHCR, Caddy HTTPS, persistent host data, reviewer credentials, and deployment guide | Hosted workflow and redeploy checks pass; README and demonstration route are accurate. Off-host backup/restore rehearsal remains open. |

Build a working vertical path early, then broaden it. Do not implement four disconnected page demos and postpone persistence, permissions, source linkage or failure handling until the end.

## Verification that matters

- Import/check contracts: sheet/row provenance, candidate normalization with raw values intact, strict >10,000 and >10% boundaries, favorable variances, zero budget, missing approval-role evidence, offboarded-property context and conflicting dates.
- Review contracts: stable evidence IDs, current-version approval, repeated submissions, return/revision, stale async response rejection, correct action route, balanced reclass and scoped resolution.
- Job contracts: retry/cancellation, lease recovery, no duplicate run results, and no open SQLite transaction across model waits.
- Package contracts: all cases in scope, mandatory unresolved work, optional summary, manager edits leave facts unchanged, print/CSV use the frozen snapshot and internal source provenance remains intact. No demo/simulation labels are required in the displayed report.
- End-to-end: import → workspace → case evidence → agent revision → manager approval → recorded execution/check → package. Include an LLM outage and conflicting evidence.
- UI verification: inspect populated/long-content/expanded preview, empty/loading/error/retry states, keyboard focus, phone widths, enlarged text and supported themes. Tests must verify behavior rather than wording or zero-border styling.

Use a small labelled evaluation set drawn from varied coding descriptions, valid lookalikes, missing causes and contradictory support. Report evidence quality and limitations; do not claim measured close-time savings from the synthetic pack.

## Production delivery

The existing DigitalOcean droplet runs shared Caddy, the web/API container, and one worker through Docker Compose. Web/worker mount the same host directory; this includes SQLite's WAL/shared-memory files and immutable uploads. The production data directory is outside the checkout/image. Development keeps its configurable gitignored data directory inside the codebase.

Use short transactions, WAL, busy timeout and a patched embedded SQLite build. Verify the actual driver SQLite version against current WAL advisories. Run migrations once during controlled deployment. Back up using a consistent SQLite backup method and retain referenced immutable files; copy completed backups off-host and rehearse restore. The single droplet is a simple reviewer topology, not high availability.

The shared 2 vCPU/4 GiB host has explicit 320 MiB web and 384 MiB worker limits. Images are built off-host for `linux/amd64`; health checks, restart policies, bounded logs, pinned SSH host verification, and immutable commit tags are configured. No Redis, managed queue, vector store, separate Python service, or managed agent hosting is required by this workflow.

## Remaining production work

The application and required deployment checks are complete. Remaining operational work is bounded:

1. Add scheduled off-host backup for the SQLite database and referenced archives, then rehearse restore and host reboot.
2. Configure a provider credential only if live AI drafting is required on the shared reviewer deployment. Credentials remain in the ignored server environment; deterministic/manual workflows remain available without them.
3. Monitor memory, swap, disk, certificate renewal, and the shared reviewer credential for the duration of the review window.

The original planning-only boundary was superseded by D022 for implementation and verification, D023 selected OpenAI Responses, and D029 records the DigitalOcean reviewer deployment. Deployment success does not establish an accounting-system integration or authorize external financial activity.

## References

The [architecture](architecture.md) records primary technical sources and storage/provider details. The [UI rules](ui-guidelines.md) govern the visual implementation. The [screen map](screens-and-workflow.md) and screen walkthroughs retain domain behavior; newer UI rules supersede redundant historical preview copy.

## November 2 case reading order and accounting language

Case review now presents the finding and recommendation, supporting records, and next action in that order in the DOM and at desktop/phone widths. The next action is specific to the signed-in role and review stage. Approval blockers are explained directly; technical review requirements remain accessible in a disclosure. The phone case header gives the finding its own row.

AGENTS.md and the UI guidelines apply the plain accounting language standard to all product writing, including AI prompts and reports. Rule-generated explanations now use shorter accounting language, and existing pending rule drafts display exact plain-language equivalents without changing saved review history. AI case and package-summary prompt versions were updated; case drafts request at most two summary sentences and three rationale sentences, with uncertainty and next actions preserved. Existing AI drafts require a new revision to use the new instructions.

All 88 unit tests, TypeScript and ESLint passed. The isolated full browser suite passed before the phone-header adjustment; the affected workflow was rerun for the phone adjustment and light/dark captures. Live evaluation run-4UD47G passed all three mechanical accounting checks, and its three summaries/rationales were read for plain language. It retained missing-evidence stops, the supported grounds reclassification and the capitalization-policy requirement. This is a bounded evaluation, not a guarantee of every future model response.

The final isolated production build also passed compilation, TypeScript, page generation and optimization. The existing metadataBase warning remains unrelated to this change.
