# Case review design walkthrough

Updated October 31, 2026. Case review is implemented with server-enforced manager/accountant roles, durable evidence/proposal versions, approval gates, execution records, refreshed-record checks and issue resolution. The accepted Sunset Ridge design below remains a historical walkthrough baseline. Actual startup and role-based operation are in the [local runbook](../local-runbook.md).

The historical `case-review-sunset.html` conversation preview used three illustrative issues; the current imported Sunset Ridge scope contains four findings, including an approval-evidence gap. The earlier Campus Edge example remains design history. The current app uses SQLite and verified live-provider integration: an actual tool-loop revision returned HTTP 200 with two source references and the supported grounds amount. This does not imply external accounting-system posting or broad model quality. The full worker run is verified: Submitted, 67/67 complete, no run error, with 16 live semantic drafts and 51 rule-only preparations. See the [implementation status](../implementation-plan.md).

## Purpose and layout

Give the Property Accounting Manager and staff accountant the original evidence, proposed treatment, and outstanding action together. Use three coordinated areas:

1. Evidence: original invoice rows, chart of accounts, close context, missing information, and clearly distinguished supplemental support.
2. Proposed correction: source-linked analysis, current proposal and evidence versions, the appropriate correction route, conditional JE lines where supported, and revision history.
3. Handoff and review: internal request, staff support, agent revision, manager decision, execution record, scoped verification, and issue resolution.

Keep property, period, source snapshot, selected issue, and current status visible. Show agent, staff accountant, and manager as action owners. These labels describe the walkthrough actors; they are not authenticated role switching or an authorization system. Narrow layouts stack the same areas.

## Three independent Sunset Ridge issues

| Issue | Original evidence | Initial conclusion | Illustrative correction route after simulated support |
| --- | --- | --- | --- |
| StaffBridge duplicate candidate | B2 rows 15/296: `INV-88241` / `88241`, matching vendor, property, date, and 5,017.79 amount; both Approved. | Candidate only; posting/payment state and source transaction identity are missing. | Simulated support establishes two posted unpaid bills for one obligation, with no scheduled payment. Propose reversal of the exact extra bill through AP, not a standalone GL reversal. |
| Grounds maintenance coding | B2 row 424: Lone Star Lawn Co., Monthly grounds maintenance, 2,214.16, coded 6410 Electric. B1 rows 7/12 identify 6210 Landscaping and 6410 Electric. | Suggest coding review; the original invoice and treatment policy are absent. | Under an explicit simulated same-entity, open-period policy permitting a manual expense reclass, prepare debit 6210 / credit 6410 for 2,214.16. Do not also execute an AP reclassification. |
| Office supplies duplicate candidate | B2 rows 34/186: `INV-89546` / `89546`, matching vendor, property, date, and 502.34 amount; both Pending. | Candidate only; Pending does not establish whether either record is posted. | Simulated support establishes an extra unposted invoice. Propose rejecting/canceling that exact invoice in intake; no accounting JE. |

These are separate issues within one property. Resolving one does not resolve the others or complete the property close. Initial candidate exposure is not confirmed liability, payment, loss, or savings.

Sunset Ridge's first six close steps are source-reported Complete in B4 rows 34–41, while B3 rows 30–36 contain no category beyond the strict greater-than-10% threshold. That context makes a useful investigation story, but neither source establishes independently verified close readiness.

## End-to-end walkthrough

| Stage | Actor and visible action | Result and gate |
| --- | --- | --- |
| Prepared | Agent assembles the original rows and initial finding. | Evidence gaps are explicit; no executable correction is supported yet. |
| Requested | Manager or staff accountant records the targeted internal request. | Request asks for source transaction identity, original invoice, posting/payment state, period, and applicable authority. No message is sent. |
| Evidence received; prior proposal stale | Staff accountant adds the support packet. | Supplemental sources get stable IDs and provenance. Earlier proposals and decisions remain historical. |
| Agent revises | Agent compares the relevant support and drafts a new proposal. | The new version states the correction route and uses only supplied support. Missing payment evidence blocks a ready correction; contradictions remain explicit. |
| Ready for manager review | Current evidence supports the proposed action. | Readiness means ready to review this proposal, not accounting correction completed. |
| Approved for correction | Manager reviews the current proposal/evidence version and approves within the simulated authority. | Approval is bound to those versions. It is separate from payment release, posting, and resolution. |
| Execution recorded; verification pending | Staff accountant records a simulated source-system execution reference and refreshed affected records. | This records what the walkthrough says was executed; the preview does not perform a financial transaction. |
| Scoped check | Agent compares the execution and updated AP/GL records against the approved action. | Wrong transaction, conflicting amount, missing records, or a stale approval blocks resolution. A model statement alone is not proof. |
| Issue resolved | Manager reviews the check and confirms resolution of this issue. | Other Sunset Ridge issues remain open. Original B3/B4 values and close status are unchanged. |

For the default unpaid StaffBridge example, the affected AP and GL records must agree with the approved reversal, the valid bill remains, and no cash movement is claimed. Bank evidence is required only when cash is affected; do not pretend to have performed a bank reconciliation here.

## Supplemental demonstration support

Added statements, invoice representations, AP/payment extracts, period/authority policies, execution references and refreshed records remain documented fixtures. Per D020, do not label them Demo/Simulated in the product or expose fixture prefixes in display IDs. Retain internal provenance and stable source identity, and distinguish Original workbook from Supplementary support in the evidence view. They are not employer-supplied records or policies.

Distinguish a staff accountant's attributable statement from the simulated supporting records. A person's statement is not itself independent proof of posting or settlement. The preview demonstrates how a real application would retain those different evidence types and compare them.

The coding example's manual-JE permission, same-entity treatment, and open period are simulated assumptions. They must not be presented as company policy inferred from README. The only supplied README policies concern Regional Manager approval before payment for invoices strictly above 10,000 and variance commentary strictly above 10%.

## Revision, return, and failure behavior

- Preserve original raw identifiers and source amounts. Normalization helps identify candidates; it does not authorize deletion or posting.
- A manager returns a proposal with a reason. The agent can revise wording/treatment against unchanged evidence; a request for new facts needs a new source packet. Do not silently invent the missing fact to satisfy the return reason.
- New substantive evidence makes the affected proposal stale and earlier approval historical. Require revised preparation and renewed approval before recording execution against that proposal.
- A missing-payment support example prevents the duplicate from becoming ready for correction. A conflicting refreshed-record example prevents resolution after execution is recorded.
- Retain source-specific history so old proposals reference the evidence actually used, not a mutable latest-support pointer.
- A drafting or verification failure retains support, prior versions, decisions, and execution records for review or retry. Do not label an incomplete check passed.
- Each issue retains independent request, evidence, proposal, approval, execution, and resolution state.

## Agent, code, and LLM responsibilities

Code owns matching arithmetic, account validity, JE balance, source references, state/version gates, and comparison of structured records. The agent coordinates scoped retrieval, gaps, revision, and handoff. The LLM interprets descriptions and attributable explanations, drafts a specific request, and revises supported analysis. It does not invent payment state, approval authority, or posting dates, and it does not certify the books.

The interactive preview scripts fixtures and expected transitions. It makes no LLM, messaging, accounting, or database calls and performs no posting, payment hold, budget change, or owner-report delivery. Keep these implementation facts in project documentation rather than repeated interface narration. Current role labels and checkboxes are not production access control.

## Review checkpoint

The user accepted the revised layout, three correction routes, version-specific manager review, and distinction between approval, execution, and confirmed issue resolution. The next design discussion is [Review package](review-package.md). This design acceptance does not imply a working application or an accounting integration.
