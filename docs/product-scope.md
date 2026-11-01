# Month end close product scope

Status: implemented locally, updated October 31, 2026. All four screens, authenticated manager/accountant roles, durable SQLite preparation and review workflow, and frozen HTML/CSV packages are connected. The [implementation plan and status](implementation-plan.md) and [local runbook](local-runbook.md) describe the actual application. Azure remains future work, not an authorized or completed deployment in this local build scope.

Current source preparation yields 67 findings: 7 duplicate candidates, 10 coding reviews, 6 variance-commentary findings, 28 approval-evidence findings and 16 close findings. Sunset Ridge has four findings, including the approval-evidence gap; earlier three-issue examples below are historical walkthrough fixtures, not the complete current property scope. Type/lint, 42 unit tests, full browser workflow, native build and local Linux login/worker/restart-persistence checks passed. OpenAI account/model access and actual application Case review/package-summary calls are now verified. Full worker preparation passed at 67/67 with no run error, including 16 live semantic drafts and 51 rule-only cases; see the runbook.

## Audience and outcome

The users are the Property Accounting Manager and staff accountants, as specified in Scenario B. The manager is the primary reviewer. Staff accountants verify transaction facts, supply attributable support, and record execution by an authorized accountant or AP owner in the source system. Other evidence owners can answer targeted follow-ups. The agent prepares the evidence, analysis, commentary, and correction workpapers that staff would otherwise assemble from the supplied workbook and later support.

The manager should be able to answer: Which properties need intervention before owner reports are due on business day 8, what does the evidence establish, and what action remains?

Reduce total preparation, review, and follow-up effort. Group repeated signals and shared evidence gaps so automation does not transfer a larger queue to the manager. The product claim is automated preparation with exception review, not proof that an accounting role has been eliminated.

The intended operating path is:

Workbook intake → automated checks → agent investigation and drafting → staff evidence return → revised proposal → manager review → authorized source-system execution where needed → scoped verification and manager-confirmed issue resolution.

The agent can prepare a complete review package from all supplied records. The workbook cannot support completing the entire accounting close: bank, AR, detailed payroll, a complete ledger, payment status, and approver-role evidence are not provided.

## Terminology

| Term | Meaning |
| --- | --- |
| Snapshot | An immutable imported workbook version, with source locations, scenario clock, and policy version. |
| Finding | The result of a specific implemented check; it may be a candidate requiring investigation. |
| Case | Related findings grouped into an actionable review item with evidence and a responsible owner. |
| Draft commentary | Proposed text awaiting human review; missing causes remain explicit. |
| Correction proposal | A source-linked recommended remedy, with prerequisites, exact affected records, and conditional JE lines only where supported. Approval does not mean executed. |
| Issue resolution | A reviewed conclusion supported by the relevant execution and refreshed records; distinct from commentary acceptance and property-close completion. |
| Review package | An internal accounting handoff containing the structured case register, decisions, correction references, open requests, source versions, and optional reviewed summary. It may contain open items and does not certify owner-report or close readiness. |
| Reviewed package snapshot | An immutable version of the selected scope, case/evidence versions, included wording, open items and manager review. Later case changes affect a new current draft, not this historical snapshot. |
| Preparation complete | The supplied-data review run has finished. Open evidence requests may remain. |
| Accounting readiness | Whether required close work and support are complete. Preparation completion or package acceptance does not establish this by itself. |

## Required path for the first build

| Feature | Proposed behavior |
| --- | --- |
| Workbook intake | Import B0–B4 and README policy context; validate schemas, retain original values and sheet/row references, and surface invalid records. |
| Run close review | Start an unattended preparation run across all applicable records and show stage, progress, failures, and remaining work. |
| Reproducible checks | Detect duplicate candidates, material variances without commentary, unsupported approval evidence, overdue steps, off-boarded-property references, and conflicting dates or completion evidence. |
| Agent investigation | Retrieve permitted case evidence through typed tools, summarize supported facts, identify gaps, and propose follow-ups. |
| Commentary preparation | Draft text from calculated facts and supplied explanations. Leave unknown causes explicit. |
| Correction workpapers | Prepare the appropriate import/invoice/AP/reclassification route. Do not generate a standalone JE for every finding. Obtain posting/payment state, source transaction identity, period, and authority first. |
| Manager workspace | Lead with property-by-property close progress and blockers. Show reported steps, responsible accountants, grouped cases, and drill-down evidence; prioritize using stated materiality and deadline rules. |
| Staff handoff | Record attributable support separately from supporting records. After approval, record authorized source-system execution references and refreshed affected records; the application does not perform the financial correction. |
| Manager decisions | Accept supported commentary, return a proposal with a reason, dismiss a false positive with a reason, reassign a case, request evidence, approve the current correction proposal within authority, or confirm supported issue resolution. |
| Scoped verification | Compare refreshed affected records with the approved action; keep conflicts and missing evidence open. Resolving one issue does not complete a property close. |
| Review history | Record source version, model/provider, prompt version, tool activity, drafts, edits, and decisions. Retain previous versions when evidence changes. |
| Internal review package | Preview all cases in the selected scope, showing correction approval, execution and resolution separately. Keep unresolved items mandatory; an optional inline LLM summary can be revised, edited and accepted without changing the register. |
| Package versions and export | Save a manager-reviewed internal snapshot and preview/export its exact contents, including unresolved items, source/case versions, scope and limitations. The Screen 4 preview shows planned export content without generating a file. |

A large shared evidence gap should be grouped. For example, the pack's 58 invoices above $10,000 can be presented under one missing approver-evidence category with invoice drill-down. They are not 58 proven policy violations.

## Agent and application responsibilities

Application code parses records, performs arithmetic and matching, applies strict policy thresholds, computes deadlines, enforces tool permissions and review transitions, and persists changes. An LLM does not determine its own approval authority.

Within that workflow, the agent can call case-scoped evidence tools, inspect related records, create draft cases, commentary and correction proposals, record missing-evidence requests, compare refreshed records, and submit a validated review package to the application inbox. This is a bounded tool-calling investigation, not merely a single prompt labelled as an agent. The LLM interprets descriptions and attributable explanations; code owns matching, amounts, account validity, balanced-entry checks, and state/version gates.

The run does not authorize financial posting, invoice payment, original-budget changes, owner-report delivery, or external messages. Those operations have no supplied integration or approval policy. An evidence request is an application follow-up or draft message, not an automatically sent email.

Manager acceptance of a package must not silently resolve its unanswered questions. Keep reported source status, evidence sufficiency, and human review disposition as separate fields.

In Review package, use the LLM for an inline source-linked handoff summary rather than a separate chatbot. Code owns the structured register, counts, amounts, mandatory open-item inclusion, version checks and snapshots. Summary acceptance, package review, correction approval and issue resolution are distinct. A model outage leaves the structured register and manual editing usable; a summary is optional.

## State and recovery

Proposed run stages: Queued → Importing → Checking → Investigating → Drafting → Validating → Submitted. Technical failure and cancellation are separate outcomes. A submitted package can contain unresolved evidence requests.

Proposed case stages: Prepared → Evidence requested → Evidence received/proposal stale → Agent revision → Ready for review → Approved for correction → Execution recorded/verification pending → Scoped check → Manager-confirmed issue resolution. A supported commentary-only case can follow its narrower review path. Track disposition, evidence sufficiency, execution, verification, and unresolved follow-ups separately. Accepting wording or approving a correction does not automatically resolve the issue or establish its cause.

- Invalid records remain visible and traceable; material import failures prevent a false successful run.
- Missing evidence creates a precise question and leaves the issue open.
- Invalid LLM output gets a bounded retry, then a factual fallback marked draft unavailable if necessary.
- Tool, time, token, or call limits persist progress and report incomplete preparation. Exact budgets will be set during evaluation.
- Repeated runs on the same snapshot and rules reuse or explicitly supersede cases rather than creating duplicates.
- Changed evidence invalidates affected drafts and previous approvals as appropriate while retaining history.
- Correction approval binds to the current proposal and evidence versions; new substantive support requires revised preparation and renewed review. A return reason can trigger revision against existing evidence, but missing facts require an added source packet.
- Missing posting/payment support blocks a ready correction; conflicting execution or refreshed-record evidence blocks resolution.
- Workbook text and supplied explanations are treated as data, never as instructions that expand tool permissions.
- Current package drafts track case/evidence versions. New substantive case updates make the included summary stale and clear current package review. Immutable reviewed snapshots retain the original contents and are labelled historical when current cases differ.

## Sunset Ridge lead demonstration

1. Run close preparation on the supplied workbook.
2. Open Sunset Ridge: its early close tasks are source-reported Complete and no B3 category exceeds 10%, yet its invoice records contain two duplicate candidates and a coding-review finding.
3. Start with StaffBridge's 5,017.79 pair (B2 rows 15/296). The agent presents the match and missing posting/payment evidence; it cannot yet choose an executable remedy.
4. Record the internal request. Have the staff accountant add explicitly simulated support, separating attestation from invoice/AP/payment/period/authority records. All added identifiers use `DEMO-` provenance.
5. Have the agent revise the proposal. In the default fixture, two posted unpaid bills represent one obligation, so the remedy is an AP reversal of the exact extra bill. Show proposal/evidence versioning and manager approval of that action.
6. Record simulated source-system execution and refreshed records. Have the agent perform a scoped comparison and the manager confirm this issue's resolution. Other Sunset Ridge issues and the original B3/B4 snapshot stay unchanged.
7. Explore the distinct grounds-maintenance route: 2,214.16 coded 6410 Electric (B2 row 424), proposed 6210 Landscaping (B1 rows 7/12). A conditional manual reclass requires explicit simulated policy, same entity, and an authorized open period. Do not also execute an AP reclassification.
8. Explore Office Depot's 502.34 pair (B2 rows 34/186). With simulated evidence that the extra invoice is unposted, propose invoice rejection/cancellation rather than a JE.

The [Case review walkthrough](screens/case-review.md) records the accepted conceptual Screen 3. Missing-payment and conflicting-refreshed-record examples demonstrate blocked transitions. All supplemental policy, evidence, execution, and updated records are simulated; the preview makes no LLM, accounting, messaging, database, or authentication calls. Campus Edge commentary revision and Aggie Commons material duplicate review remain proposed supporting cases.

The selected [Review package walkthrough](screens/review-package.md) continues with a separately constructed one-property fixture: Labor resolved, Grounds approved with execution outstanding, and Office awaiting evidence. It does not import actual Screen 3 interaction state. All three remain in the register and snapshots. Later simulated updates show Grounds execution pending verification, then Grounds resolution, while Office stays open. Original B3/B4 values stay unchanged. Apply [ui-craft rules](ui-guidelines.md): a concise summary and one action table in the default report, with full source/version records available in Audit details.

## Policy and scenario assumptions

- README `A18`: invoices strictly over $10,000 require Regional Manager approval before payment. Generic Approved/Pending status does not establish approver role or payment.
- README `A18`: commentary is required for categories more than 10% off budget in either direction. Zero or missing budget needs an explicit calculation outcome rather than division by zero.
- Use Scenario B's business-day-6 snapshot for the September 2026 close. The workbook also states October 16 as a general data date; retain and display the discrepancy, including future completions in the tracker. Do not silently substitute the current date.
- The invoice register is not established as the full expense ledger. Related AP records do not by themselves prove the cause of a budget variance.
- Candidate duplicate amounts are review exposure, not confirmed losses or savings.
- Close-accountant ownership from B4 and invoice Coded By are distinct fields.

## Extensions under discussion

Budget or forecast review requests, broad document ingestion, enterprise SSO/user administration, and real accounting-system integrations remain extensions. Two private authenticated demo accounts with server-enforced manager/accountant permissions are in the selected implementation baseline. Actual posting, payment release/holds, recovery, and owner-report delivery remain outside this prototype. Approval routing or period treatment beyond the two supplied policies must remain an explicit simulated assumption until confirmed.

## Manager operating view

Added November 1, 2026 under D030. The Workspace opens with an attention strip computed from the workbook and current review state:

| Item | Definition |
| --- | --- |
| Properties needing close follow-up | Distinct active properties with overdue tracker steps whose close case is open, or a required variance commentary whose case is open. It does not predict which owner reports will be late. |
| Commentary marked Complete without required explanations | Properties whose tracker reports Variance commentary Complete while a category over the 10% policy threshold has no commentary in the workbook. Accepted wording reduces the count; the imported tracker is not rewritten. |
| Threshold reviews | Commentary steps due by the snapshot at properties with no category over the threshold. They need a confirmed review, not new commentary, and never close automatically. |
| Invoices flagged for amount verification | Invoices with a robust z-score above 5 against at least 8 other invoices sharing a description. Verification stays outstanding; the app records no payment hold, and Regional approval evidence remains a separate review. |

Managers also see an overdue-by-stage matrix (accountant by stage, tracker as of BD6) and a short AI priorities briefing whose numbers, people, amounts and links must come from the computed facts. Every strip item, matrix count and briefing link opens filtered properties, cases or the flagged-invoice list. A usage line counts AI case drafts as generated, approved directly, returned, pending review or superseded; these are workspace counts, not evidence of repeated production use.

Variance cases include the property's AP rows for the category. Drafts describe their count, total and any out-of-period dates and ask the responsible accountant to confirm timing or completeness; they do not establish the cause.

## Success measures

Measure preparation and review time, factual accuracy, useful findings versus false positives, commentary acceptance and rework, unresolved evidence, and exceptions resolved before deadline. After a real pilot, measure repeat use and close timeliness. Record model cost and latency. The synthetic workbook provides no measured labor-saving baseline or evidence of achieved customer retention or financial savings.

The [showcase assessment](showcase-assessment.md) defines the engineering proof and evaluation plan. The [screen map](screens-and-workflow.md) shows how a manager completes the proposed workflow.
