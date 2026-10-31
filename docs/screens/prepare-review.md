# Prepare review design walkthrough

Updated October 31, 2026. Prepare review is implemented with workbook intake, durable SQLite run state, a separate preparation worker and partial-drafting recovery. The accepted conceptual design below is retained as the behavior contract, not a claim that every historical preview state was rendered in the current app. See the [local runbook](../local-runbook.md).

Current source preparation yields 67 findings. The earlier isolated Linux check completed 51 rule-only preparations while drafting was partial; the later full live run completed all work. OpenAI account/model access and selected live application Case review/package-summary calls now passed. The full worker run is verified: Submitted, 67/67 complete, no run error, with 16 live semantic drafts and 51 rule-only preparations. Core/native/browser and local container login/worker/restart-persistence checks passed. Azure is not deployed.

## Purpose

Let the Property Accounting Manager understand the selected input and scope, start an agent-led preparation run, and inspect its progress or partial results. This screen prepares work for review; it does not approve accounting conclusions or close the books.

Use one screen with two main states: source review before the run, and preparation progress during/after the run. Keep the accepted application navigation and September 2026 / BD6 / owner-report BD8 context.

## Before preparation

The main panel shows the selected workbook, source preview, recognized input counts, timing notices, source coverage, and a scope confirmation. One primary action starts preparation.

The supplied workbook contains 40 property master records (38 active), 20 account codes, 437 invoice records, 266 budget/actual rows, 304 close-step rows, and two README policy notes. Source availability is distinct from independently validated accounting completion.

Available checks cover AP candidates, variance/commentary gaps, and reported close progress. Detailed bank/AR/payroll support, a complete ledger, approver roles, and payment evidence are unavailable. These omissions limit investigation and produce evidence requests; they are not automatically fatal import errors.

The timing notice preserves the general October 16 data date and selected BD6 close clock. Three B4 completion dates fall on BD7 in this snapshot. The manager confirms the September/BD6 scope rather than silently accepting a different clock.

Missing required sheets/fields or materially invalid mandatory data blocks preparation until corrected. Warnings and unavailable optional support remain visible without implying those checks passed.

## Agent run stages

| Stage | Responsibility | Outcome |
| --- | --- | --- |
| Read and freeze source | Code | Original records, period, policies, and source references preserved. |
| Calculate checks | Code | Reproducible date, amount, matching, and threshold results. |
| Investigate and group | Agent with permitted tools and LLM assistance | Related findings, retrieved evidence, and explicit gaps. |
| Prepare drafts | LLM | Supported commentary, questions, and property handoffs; no invented causes. |
| Check drafts and references | Code | Schema, amount, source-ID, and required-field checks. This is not a guarantee of factual correctness. |
| Submit for manager review | Agent orchestration | A separate review version with drafts and unresolved items. |

The agent coordinates bounded work and progress. The LLM handles interpretation and drafting inside that workflow. The application owns arithmetic, permissions, state, retries, and persistence.

Do not show a fabricated accuracy or overall readiness percentage. Show the actual stage and completed/unfinished work. Technical provider/model settings and traces belong under Preparation details rather than the manager's main form.

## Manager actions

| Action | Expected behavior |
| --- | --- |
| Choose source | Select the supplied workbook or a different file for validation. |
| Preview source | Inspect recognized inputs, original sample records, and provenance. |
| Inspect timing notices | Understand date conflicts and the selected close clock. |
| Confirm scope and start | Freeze the selected context and start a separate preparation version. |
| Leave and return | Reopen persisted progress; avoid duplicate jobs. |
| Cancel remaining work | Stop further preparation while retaining completed work. |
| Resume | Continue eligible unfinished stages without duplicating cases or decisions. |
| Retry drafting | Retry only affected model work through the same configured provider; no silent fallback. |
| Open workspace | Inspect the new prepared version, or available findings with drafts explicitly unavailable. |

Keep additional operator explanations in Screen 3. They need a property/case, author, period, source type, and revision history; a global context textbox would obscure provenance.

## Result states

- Normal: Preparation complete; open evidence requests remain. Manager review still follows.
- Model failure: checks available; AI drafting incomplete. Preserve calculated findings and source access. Offer Retry drafting and Open available findings.
- Cancelled/interrupted: completed work retained; preparation remains unfinished. Resume eligible work.
- Blocking import issue: preparation cannot begin; expose the affected source/field.

Source snapshots, prompt/policy versions, and reviewer decisions remain separate. Repeated identical inputs should reopen or explicitly supersede an existing run rather than duplicate cases. Detailed persistence and deduplication rules will be specified during implementation.

## Preview boundaries

The interactive screen preview uses source counts and examples from the synthetic workbook. It simulates stages and outcomes without reading uploaded file contents, calling an LLM, creating a database, or running a real worker. A different selected filename is not falsely assigned the supplied workbook's counts or a successful validation.

Preview design controls allow normal preparation, LLM unavailability, and a clearly labelled example import error. A retry simulation assumes the same provider recovers. Do not present those interactions as measured performance, actual job persistence, or a verified integration.

## Review checkpoint

Source review, staged preparation, and partial-result presentation were accepted at the conceptual layout level. Continue with [Case review](case-review.md). Acceptance of a design does not establish implemented functionality or authorize external messages or financial changes.
