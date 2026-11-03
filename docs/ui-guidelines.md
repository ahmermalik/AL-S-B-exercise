# UI and copy rules

Selected October 31, 2026 after the user accepted the functional walkthroughs and challenged their verbosity. Apply [ui-craft](/Users/ahmer.malik/.codex/skills/ui-craft/SKILL.md) throughout implementation. The previews establish workflows, not a requirement to reproduce every panel, badge, or explanatory paragraph.

## Composition

- Put property, period, and source context once in the page header. Retain local context when a case or exported report must stand alone.
- Make the next action clear through the layout and button label. Remove paragraphs that explain an obvious control.
- Use one main action for the current task. Secondary actions remain available without competing for emphasis.
- Use readable tables and spacing for continuous work; reserve separate surfaces for independent objects and foreground details. Do not nest a frame around every fact.
- Use system sans-serif type, a small spacing scale, the verified Asset Living palette below, and semantic warning/error states. Maintain readable text, keyboard focus, light/dark contrast, and touch targets. Status must also have a text label.
- Prefer a contextual detail view for evidence, history, technical activity, and full provenance. Keep missing support and the consequence of the current decision visible at the decision point.
- Long notes, errors, expanded evidence, empty/loading states, phone layouts, enlarged text, and reduced motion are implementation review states, not reasons to add permanent helper paragraphs.

## Brand and visual hierarchy

Revised October 31, 2026 after the owner rejected the original flat blue-gray treatment. The current [official Media Hub](https://www.assetliving.com/resources/media) links the [brand guidelines](https://cdn.prod.website-files.com/645bfa68c2a14cfafc39ece5/691b91f2942667a5111189f1_Brand%20Guidelines%20-%20Asset%20Living%201.pdf). Its color page specifies Asset Blue `#003C71`, Medium Blue `#00A1E4`, Light Blue `#90D7F2`, Asset Green `#A6CE39`, and Asset Orange `#F2A900`. Pale companions are Sky Blue `#E3F5FC`, Light Green `#D6E8AA`, Light Orange `#FDE6B2`; Offwhite is `#F8F6F3`.

| Role | Treatment |
| --- | --- |
| Application identity and navigation | Asset Blue frame, official white logo, active navigation and brand color divider. |
| Source evidence | Neutral blue-gray header and quieter source surface. |
| Prepared analysis | Cyan header/accent, dominant proposal text and a separate source-reference area. |
| Manager review | Navy header; next action receives its own visible area. |
| Missing support or pending action | Orange/light-orange emphasis, a specific action and text state. |
| Reported completion or resolved work | Green treatment with a label; original source status remains separate from verified resolution. |
| Overdue, conflict or failure | Accessible red semantic extension with a text/icon distinction. Red is an application status color, not an official brand color. |

Use larger figures, readable 14–16px operational text and 18px section headings. Filled actions identify the actor's next task; secondary actions remain quieter. Color separates information roles and states, rather than decorating every card. Keep all three Case review responsibilities visible at ordinary desktop widths. Dark-mode surfaces adapt without changing brand identity or state meaning. The header appearance control lets users choose light or dark independently of the operating system; the choice persists in this browser.

The official website white logo SVG is retained unchanged in `public/brand/`; the Docker runtime includes that directory. System UI fonts are used for operational text; the proprietary print fonts are not bundled.

## Working-product presentation

The owner's direction is a polished real-world accounting application. Present the user's task rather than the interview exercise or the preview mechanism.

- No Demo, Simulated, Scripted preview, Preview only or similar banners, badges, status suffixes, staff-role qualifiers, control labels or report notices. Use Record execution, Add support and Resolved as ordinary product language.
- Retain the distinction between original workbook records and supplementary support where it helps review. Keep fixture origin in internal metadata and project documentation. Render reference IDs normally; internal fixture prefixes need not be visible.
- Keep meaningful accounting states and uncertainty: Candidate, Awaiting evidence, Approved for correction, Execution pending, Draft and Reviewed. Removing harness labels must not silently change what a record establishes.
- Use one coherent navigation and task model across desktop and phone. Preserve period/property context, selection, unsaved edits and a clear return path.
- Give all primary actions complete behavior and feedback: save progress, duplicate submissions, interrupted preparation, stale review, model failure and retry. Keep loading geometry stable and confirm success against the actual saved version.
- Use progressive disclosure for sources, history, audit details and technical diagnostics. Main screens should expose the relevant facts and next action without teaching the user how the application was built.
- Use restrained motion for meaningful changes, honor reduced motion, support keyboard focus and enlarged text, and retain readable contrast and touch targets. Polish must come from composition and behavior rather than decorative AI cues.

This is the implementation standard. Copy cleanup alone is not evidence that persistence, authentication or integrations have been implemented or production-tested.

## Ownership of information

| Information | Visible owner |
| --- | --- |
| Property close progress and blockers | Close workspace. |
| Import scope and preparation progress | Preparation. |
| Evidence, proposed treatment and the next case action | Case review. |
| Reviewed outcomes and outstanding handoff work | Review package. |
| Original workbook rows and supplemental support | Case/source detail. |
| Source manifest, exact version metadata and model activity | Audit details. |

Do not repeat a case register as an outstanding-work appendix when the same table already contains status, owner, and next action. Do not hide unresolved items to shorten a package.

## Review package and export

The default report needs a short header, an optional concise handoff summary, and one case/action table. Include the property/period, package version, case status, next action, and responsible person. Preserve the compact internal-review designation. Fixture provenance belongs in internal metadata/documentation rather than report banners.

A full source manifest is not necessary in the default manager preview or report. Keep source IDs and evidence versions in persistent records and accessible Audit details. The case links provide a route to evidence; an optional audit export can be added later if useful. Moving provenance out of the main report must not delete it from the system.

Use **Package preview**, with a concise Draft or Reviewed label and Back to review. Avoid long titles such as Export preview · unreviewed draft. Show a dedicated reading view rather than append a second register below the editing screen. Printing uses the same frozen snapshot, with controls omitted and all cases in scope retained.

## AI in the interface

Use contextual actions: Revise analysis in Case review and Draft summary or Revise summary in Review package. Identify AI-originated text with a compact label. Keep source access, version comparison, manager edits, and review state available.

Do not add chat, AI-persona narration, a confidence score, or a technical tool log to the normal accounting task. The LLM interprets supplied descriptions/context and drafts wording; code owns numbers, statuses, permissions, and version gates. A model outage must not obstruct the structured register or manual work.

## Verification

Apply the rules while implementing each screen rather than waiting for a final cosmetic pass. Inspect complete rendered states with realistic records and long content. Meaningful workflow checks must still pass after copy and layout changes. Keep evidence tied to the exact screen/state reviewed; do not describe a bounded Screen 4 cleanup as a completed four-screen visual audit.

Brand-pass verification, October 31, 2026: inspected all four screens at desktop and 390px phone widths in light and dark appearance, the accountant support dialog, manager request dialog, package reading view and keyboard focus return. Phone document width remained 390px on all four screens. Local captures are under `data/qa/brand/`. TypeScript, ESLint, 42 unit tests and the Linux image build passed; the runtime includes the official logo asset. This pass exercised view/control behavior without saving case decisions or running another preparation. The earlier full financial browser workflow is separate verification. Concurrent animation edits were preserved, and a missing shell animation import was corrected.

## Plain accounting language

Applies to every visible label, message, rule-generated explanation, AI-generated analysis, briefing, summary and report. Lead with the accounting finding, state what remains unknown, and give a specific next action. Use short sentences, concrete verbs and familiar accounting terms. Preserve distinctions between a possible error, approved correction, actual execution and confirmed resolution.

Prefer “These records might represent the same invoice. The application needs posting and payment evidence before recommending a correction.” Avoid “Matching invoice identifiers identify a candidate.” Say “Supporting ledger records are still needed” instead of “ledger support remains outstanding.” Retain useful accounting terms; put system versions and diagnostics in secondary details.

Case review reads left to right, and top to bottom on phones: finding and recommendation, supporting records, next action. Keep the primary action visible for the current role and explain any blocked approval in plain language. AI instructions must follow this standard while retaining source checks, uncertainty and accounting authority rules. Reviewed historical wording remains preserved.

Case finding panel: lead with the finding and its explanation, then the information still needed and any journal entry. Keep the review status and AI-draft label visible. Group rationale, cited-record links, supporting-record versions, timestamps and manual recommendation refresh under Supporting details. Put wording actions together at the bottom; show the version selector only when there are multiple versions. The separate Supporting records panel owns the full evidence list, and the Next action panel owns the operational decision. Edit wording must start with exactly the explanation displayed to the reviewer, including plain-language equivalents for older unreviewed system drafts. Saving an edit creates a new reviewable wording version and never implies approval or changes to invoice facts.

Next action is stage-specific. Missing support shows Request evidence and a secondary dismissal, without approval controls. Ready proposals show manager review, approval/acceptance and Request changes. Accepted variance wording with open ledger support returns to the missing-support stage. Approved corrections show execution as the accountant’s next task; checked records show manager resolution. New support for a later-stage case remains available under Additional actions. Request changes records feedback in the shared case for the responsible accountant; do not imply a notification or private inbox exists. Display the feedback while revision is outstanding.

After resolution or dismissal, keep the confirmation visible and offer a next step in the same panel. Link to another open finding from the same property and import, with the property’s review package as an alternative. When none remain, make the review package primary. Load remaining work from the server; do not infer completion from a stale list or imply that the accounting close is complete.

Case handoffs: show the current support submitter and approval/acceptance reviewer with timestamps in Next action. Use the recorded account, not the supporting document author. A new unapproved proposal must not display an earlier approval as current; History retains earlier decisions. Workbook task completion is a reported source status, separate from open findings and verified correction outcomes. Name that distinction in the workspace heading and legend.

Change requests: reopen the accountant’s saved support with the manager’s feedback visible. Hide the initial sample-loading action once support exists. Unchanged submissions must explain that nothing changed and keep the form open; they must not imply a revised recommendation was submitted. Refresh the case when returning to its window, while preserving open form drafts.

For the Sunset Ridge walkthrough corrections, Load sample execution fills editable execution fields without saving or approving anything. Clearly identify sample values and retain separate Record execution, Check refreshed records and manager resolution actions.

Completed findings: show the outcome first, followed by collapsed Review history containing support attribution, approval, requests and execution. Put next-finding/package navigation last in the panel. Avoid a second Next action banner or repeated completion headings. Active review keeps attribution and required decisions visible.

Supporting records: group the original workbook, the selected recommendation’s accountant support and its recorded correction. Show compact record rows with full content in Inspect record. Collapse superseded submissions into dated history; keep them searchable and inspectable. Open the group relevant to the current work rather than expanding every submission. Selecting an older recommendation must show its support and keep newer submissions separate.
