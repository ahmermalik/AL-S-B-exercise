# Close workspace design walkthrough

Updated October 31, 2026. Close workspace is implemented in the connected local application, with authenticated access, property/close context and links into the actual cases. The accepted conceptual layout below remains design history and a behavior contract; historical preview captures are not evidence of current application UI verification. Startup and current operation are in the [local runbook](../local-runbook.md).

Current preparation contains 67 findings. Sunset Ridge has four, including its approval-evidence gap. The [implementation status](../implementation-plan.md) distinguishes completed core/Linux checks from live provider and future Azure work.

## Purpose

Help the Property Accounting Manager answer: Which properties need intervention, which close steps are outstanding, who is responsible, and what should happen next?

The [domain research](../research/property-management-close.md) established the importance of process context. The earlier case-first preview is retained as design history but is superseded by decision D007.

## Layout

1. Application navigation: Workspace, Prepare review, Review package; identify the manager role.
2. Close context: September 2026, scenario BD6, owner-report deadline BD8, selected snapshot.
3. Compact portfolio summary: 38 properties, 14 with overdue source-reported steps, and six material commentary gaps. These are source-derived counts, not an AI readiness score.
4. Property progress table: each property has eight step statuses, its accountant, reported completion count, and a next action or follow-up. All 38 tracker properties are included, with six rows per page.
5. Selected-property detail: inspect one step's reported status and available support, plus grouped property follow-ups.
6. Selected-property prepared handoff: an illustrative LLM summary and targeted question, with evidence and limitations alongside it.
7. Contextual detail: original rows, missing sources, date conflicts, and navigation to later screens.

The eight headings follow B4: Bank, AP, Rent/AR, Payroll, Prepaid, Variance commentary, Owner draft, Owner final. Compact labels are Bank, AP, Rent/AR, Payroll, Prepaid, Variance, Draft, Final. Full names are available in selected-step detail and accessible labels.

## Status meanings

The live workspace now expands **BD** as **business day**. BD4 is the fourth business day of the close cycle; the supplied snapshot is business day 6. A `!` on a step due on day 4 means its completion is not reported two business days after its deadline. This is a tracker/completion flag, not a diagnosis of a ledger discrepancy.

Clicking a step opens a compact, anchored popover with the full step name, property, deadline explanation, responsible accountant and next follow-up. Overdue, due-today, reported-complete, future and conflicting-completion states have distinct copy. A flagged step links to its property's close-tracker case when one exists; it does not fall back to an unrelated invoice/approval case. Selection still updates the detail area below. Popovers support keyboard activation, Escape, focus return, outside dismissal, and collision-aware placement on phones. Their wording comes from source facts and deterministic date checks; opening one does not invoke an LLM or certify the underlying accounting work.

| Display | Meaning |
| --- | --- |
| Reported done | B4 says Complete. This is not independent verification of its underlying workpaper. |
| Overdue | B4 says Late; the step remains outstanding beyond its deadline. |
| Due today | B4 says Due Today at the selected BD6 snapshot. Do not classify it as Late prematurely. |
| Not due | The deadline is later than BD6. BD7 draft and BD8 final are future milestones, not overdue blockers. |
| Date conflict | The source says Complete but records BD7 completion after the selected snapshot. Preserve the source status and expose the inconsistency. |

Reported completion counts include the source's Complete records, even where dates conflict. Show the conflict separately. An overdue upstream task can threaten reporting without proving a formal hard dependency; do not mark later stages Blocked unless that dependency is supplied or explicitly adopted.

## Manager actions

| Action | Result |
| --- | --- |
| Filter properties | Show all properties, overdue steps, commentary gaps, or review flags. Groups are derived from the supplied data. |
| Select a property | Update its step detail, follow-ups, owner, and prepared handoff. |
| Select a stage cell | Inspect the exact step, due/completion dates, reported status, and available evidence discrepancy. |
| Review this step | Navigate to Case review for requests, reassignment, commentary edits, and recorded decisions. The current preview shows only the destination's purpose. |
| Source records | Read the original B4 row and relevant B2/B3 records without changing them. |
| Inspect evidence and limits | Understand the handoff's support and which causes/documents remain unavailable. |
| Data and preparation details | Inspect scope, missing sources, date discrepancies, and preparation limitations. |
| Prepare review | Navigate to screen 2 to import/select a workbook and start a new preparation version. |
| Review package | Navigate to screen 4 to inspect reviewed results and unresolved items before export. |

Approval, external messages, and financial changes do not happen on this landing page. No Approve all, AI confidence score, or unsupported owner-ready percentage is proposed.

## Where AI fits

Code determines dates, amounts, counts, matching candidates, policy checks, and step displays. The LLM drafts a concise handoff from those facts, identifies missing information, and proposes a relevant follow-up to the responsible accountant.

The stronger AI contribution belongs in the later evidence/revision loop: combine relevant records with attributable operator context, preserve uncertainty, and revise commentary for review. A human attestation is not automatically independent support. The brief helps the manager understand a property; it does not establish that accounting work is complete.

Measure benefit in total preparation plus review/follow-up time. Do not present a fluent restatement of flags as proven AI value.

## Preview provenance

The conversation preview includes all 38 B4 properties and eight original step statuses, derived B3 commentary gaps, and normalized B2 invoice candidates. Triangle Park is selected initially. Prepared wording and navigation are illustrative; no live agent or persistent application action occurs.

- Triangle Park P120: zero of eight reported complete, five Late steps, commentary Due Today; B4 rows 146–153.
- Campus Edge P126: six of eight reported complete; blank Payroll commentary for a 31% variance; B3 row 170 and B4 rows 194–201. A pool invoice candidate is in B2 rows 125/197.
- Riverstone Park P103: two Late steps, blank material Utilities commentary, and a future-dated completion; B4 rows 18–25 and B3 row 19.
- Aggie Commons P128: six of eight reported complete and a roofing candidate; B4 rows 210–217 and B2 rows 217/283.
- Source totals: 183 Complete, 36 Late, nine Due Today, 76 Not Due; future completion dates occur in B4 rows 23, 31, 95.

Detailed bank/AR/payroll support and a complete ledger are unavailable. No issue found by the implemented checks does not mean independently verified readiness.

## Review checkpoint

The hierarchy, property selection, stage meanings, and prepared handoff were accepted for the conceptual Screen 1 view. Continue with the [Prepare review walkthrough](prepare-review.md). Accepted hosting and operating-model decisions remain in the decision log.
