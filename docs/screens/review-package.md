# Review package design walkthrough

Updated October 31, 2026. Review package is implemented with the actual case register, optional reviewed wording, mandatory open items, immutable package snapshots, a dedicated report view and CSV output. The [local runbook](../local-runbook.md) describes the connected application; the [UI rules](../ui-guidelines.md) govern its presentation.

The `review-package.html` conversation preview below is historical design material. Its three-issue illustrative continuation is not the current application's data or complete property scope: imported Sunset Ridge has four findings, including approval evidence. Actual reports use persisted case/package records. Historical preview captures are not actual-application UI QA. A live package-summary request covering all four Sunset Ridge cases now returned HTTP 200; the full worker run is verified: Submitted, 67/67 complete, no run error, with 16 live semantic drafts and 51 rule-only preparations. Azure delivery remains future work.

## Purpose and layout

Provide an internal accounting handoff that states what was reviewed, what was approved, what was executed and checked, and what remains open. A reviewed package may contain unresolved items. It is not a complete owner financial-report package or a certification that the property books are closed.

Keep four areas visible:

1. Package header: property/scope, period, selected package version and Draft/Reviewed status. Full source/run/case metadata belongs in details.
2. Structured case register: all three issues in scope, their separate decision/execution/verification state, amount meaning, responsible next actor, and source links.
3. Optional inline handoff summary: source-linked draft wording, revision/edit/compare controls, and version-specific wording acceptance.
4. Manager review and package actions: acknowledge the current scope and unresolved items, save a reviewed internal snapshot, preview its export content, or inspect a prior snapshot.

Case/source details and the Return to Case review handoff are contextual views. The preview's handoff is read-only and does not modify the separate Screen 3 example. Narrow layouts stack the same content.

## Illustrative initial package

| Issue | Current state in this fixture | Required presentation |
| --- | --- | --- |
| StaffBridge labor duplicate, 5,017.79 | Correction approved, simulated AP reversal recorded, scoped check and manager resolution complete. | Resolved, with the approved proposal/evidence versions, exact correction reference and refreshed-record sources retained. |
| Grounds coding, 2,214.16 | Conditional manual reclassification approved under the simulated policy; execution not yet recorded. | Approved for correction — execution outstanding. Do not label it posted, corrected or resolved. |
| Office duplicate candidate, 502.34 | Source transaction/posting/payment support still missing. | Awaiting evidence, with a concrete staff next action. Do not infer unposted state from Pending or apply the later unposted rejection fixture automatically. |

All three issues remain in every package in this scope, regardless of resolution. There is no control to hide unresolved issues. The amounts represent different accounting situations; do not total them as savings or imply a corrected B3 actual figure.

The fixture is documented demonstration context, not a product banner. D020 removes demo/simulation/scripted qualifiers from displayed statuses, summaries, reports, sources and history while preserving internal provenance and normal source distinctions. Original B2 records remain intact, and original B3/B4 actuals and reported close statuses remain unchanged. The initial package does not imply that this is the current state of all 38 active properties.

## Manager actions

| Action | Proposed behavior |
| --- | --- |
| Inspect a case or source | Show exact original/supplemental references, proposal/evidence versions, approval, execution, verification and remaining follow-up. |
| Return to Case review | Show the selected case's handoff context. The static preview does not modify the separate Screen 3 state. |
| Revise summary | Request Make concise or Emphasize next actions against the current register. The preview scripts labelled example wording. |
| Edit summary | Save a separate manager-edited wording version. Do not change case facts or statuses through text editing. |
| Compare versions | Inspect prior and current wording with the case/source context used. |
| Accept current wording | Record acceptance against this wording and case snapshot. This is neither correction approval nor issue resolution. |
| Include or omit summary | Summary is optional. If included, current wording must receive manager review; omitting it never removes the structured register or open issues. |
| Review package | Acknowledge the current scope and all unresolved items. This does not certify complete financial statements or owner delivery readiness. |
| Save reviewed internal snapshot | Freeze the current register, included summary, versions, scope, provenance and manager review as a new package version. Open issues remain visible. |
| Preview package | Open a dedicated reading view with Back to review, a short scope/version header, optional concise summary and one case/action table containing all unresolved items. Do not append a second register below the editor or repeat it as an outstanding-work appendix. Full provenance is available in Audit details. No PDF/download is actually generated in the preview. |
| Inspect package history | Open an earlier immutable snapshot and its original contents without presenting it as the latest case state. |
| Refresh cases | Load updated case states into the current draft. The preview supplies fixture updates internally. Substantive changes require renewed summary/package review; earlier snapshots stay unchanged. |

Saving a package cannot pay an invoice, post a JE, hold a payment, send email, deliver an owner report, or change a source ledger. Package review, summary acceptance, correction approval and issue resolution are distinct decisions.

## Refresh and historical behavior

The preview offers sequential simulated case updates: first, Grounds execution is recorded with verification still pending; later, Grounds is resolved after the relevant checks and manager confirmation. Office remains open. Neither update should be represented as a real accounting transaction.

A substantive update changes the current draft's case version, makes its summary stale, and clears the current package acknowledgement. If the summary is included, revise or edit it against the new case snapshot and review it again. Alternatively omit the optional summary and review the complete structured register. No prior reviewed snapshot is mutated.

A historical snapshot must preview/export the statuses, wording and references captured at creation, even when current cases differ. Mark it historical and provide an explicit path back to the current draft. Approval of an internal package with outstanding items is a review record, not an exception waiver or a close-completion claim. Retain the full source manifest in the system and expose it on demand; it is unnecessary in the default manager report.

## Where the LLM fits in the UI

Use an inline Handoff summary area rather than a separate chatbot. Label model-generated wording as an AI draft, expose its case/source links, and let the manager revise, compare, edit and accept it. The LLM can synthesize the case history into a short explanation of completed work, outstanding execution or evidence, responsible next actors, and limitations.

Code owns the register's statuses, counts, amounts, source versions, required inclusion of open issues, stale-review gates and package snapshot creation. The LLM does not decide which items may be excluded, change a correction's status, infer financial readiness, or claim savings. Editing or accepting a summary never changes the authoritative register.

The initial preview's AI-labelled summary and subsequent revisions are scripted examples, not live model outputs. A simulated model outage leaves the register and manager editor usable. The manager can write the summary manually or omit it. Exporting the structured package does not itself require an LLM.

The stronger AI demonstration remains evidence interpretation and grounded revision in Case review. Screen 4 makes that work useful to a manager through concise synthesis; it should not add chat merely to signal AI capability.

## Review checkpoint

The functional direction is selected. The current refinement removes redundant copy and repeated report sections while preserving status distinctions, mandatory unresolved items, source access and historical packages. Follow the [implementation plan](../implementation-plan.md) before application development. A bounded preview cleanup is not a completed four-screen visual audit.
