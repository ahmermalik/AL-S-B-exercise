# Property management month end close research

Researched October 31, 2026 using official vendor documentation and an actual property operator checklist. Two independent research subagents covered the close process and data integrations. Sources describe available products and examples of practice; they do not establish Asset Living's installed systems, licensed modules, API access, accounting basis, or internal approval policy.

## Conclusion

Keep the selected agent-preparation and manager-review direction. Position it as close review and evidence coordination over the property accounting system. It is not a replacement ledger, complete reconciliation engine, or proof that an accountant's job is eliminated.

The earlier case-first landing screen explains individual findings but provides insufficient close-process context. Propose a property and close-stage overview, with cases and the prepared briefing supporting that view. This is a design recommendation awaiting user review, not an accepted scope change.

## Inputs and reports are different

The exercise workbook is a curated set of property/account master records, an AP register, aggregated budget/actual data, and workflow statuses. It simulates extracts from several sources. It is not a full general ledger or complete owner-facing financial package.

In practice, teams can obtain accounting data through report exports, authorized APIs, connected reporting tools, and documents supplied by operators. Owner-facing outputs may include financial statements, owner statements, rent roll, commentary, and agreed supporting schedules. Their contents and delivery method depend on the owner's requirements and platform.

An API changes acquisition and refresh. It does not itself make the accounting complete or create a need for an LLM. A stable period snapshot and traceable evidence are still needed to explain what a manager reviewed.

## Reference process

This is a synthesis, not a universal policy. Activities can run in parallel and be repeated after adjustments. Cash/accrual basis and company/owner procedures affect the sequence.

| Stage | Work | Common participants |
| --- | --- | --- |
| Confirm period and cutoff | Select properties, month, accounting basis, reporting requirements, and transaction cutoff. | Accounting lead and site teams |
| Complete inputs | Finish resident activity, charges/receipts, invoice posting and coding, payroll allocations, and relevant schedules. | Site teams and accountants |
| Reconcile | Compare bank activity with books; investigate unmatched items; tie relevant resident/deposit and other subledgers to the GL. | Accountants and reviewers |
| Review and adjust | Investigate unusual balances, period/coding issues, possible duplicates, and budget variances; obtain support and post authorized corrections. | Accountants, operators, accounting manager |
| Prepare reporting | Assemble preliminary financials and commentary; review and revise the package. | Preparer and accounting reviewer |
| Finalize | Follow policy for final close, period locks/reopening, owner delivery, and applicable distributions. | Authorized accounting staff and management |

The evidence supports a cycle of preparation, review, correction, and renewed review. Finalization and owner delivery should follow the organization's actual process rather than an assumed universal order.

## Exact exercise workflow

The following sequence and deadlines come from B4, not an industry standard. September 2026 is the reporting period and the exercise snapshot is BD6 of the October close calendar.

| B4 step | Due | Plain-English purpose |
| --- | --- | --- |
| Bank reconciliation | BD3 | Compare bank activity and recorded cash; explain differences. |
| AP cutoff & accruals | BD3 | Review invoice timing and expenses belonging to the period; use accrual treatment where applicable. |
| Rent/AR reconciliation | BD4 | Check resident charges, payments, and outstanding balances against the relevant records. |
| Payroll allocation | BD4 | Check payroll expense allocation to the correct properties/accounts and period. |
| Prepaid & deposit roll | BD5 | Support advance-payment treatment and deposit balance movements. |
| Variance commentary | BD6 | Explain material differences from budget using evidence. |
| Owner report draft | BD7 | Assemble preliminary reporting for review. |
| Owner report final | BD8 | Complete the required final review/reporting process. |

Location: `B4 Close Tracker!A1:H305`. The workbook reports completion; it does not provide all evidence needed to independently perform or verify those steps.

## What the supplied pack can support

- B0/B1: identify properties, active status, GL codes, and categories.
- B2: review AP invoice candidates and supplied coding/status fields.
- B3: calculate variances and identify commentary gaps.
- B4: coordinate reported close progress, deadlines, and responsible accountants.
- Cross-sheet checks: detect inconsistencies between reported completion and supplied evidence.

Missing inputs include bank transaction/statement detail, complete GL, resident AR/deposit ledgers, detailed payroll, accrual/prepaid workpapers, invoice documents, and approval identity/payment evidence. The application must distinguish an unavailable data source from a passed check.

## Integration design recommendation

For the exercise, use the supplied workbook. A future authorized read-only connector can populate the same internal period snapshot. Capture property/source IDs, accounting basis, posting/service periods, extraction time, completeness, and evidence versions; reconcile counts/totals and handle pagination. Do not build fake live connectors or imply integration access exists.

## Meaningful AI role

Use code for amounts, matching, thresholds, date logic, and defined reconciliation controls. Use a bounded LLM workflow to retrieve relevant descriptions/documents, synthesize operator explanations, identify unsupported conclusions or contradictions for review, draft targeted questions, and revise commentary when evidence arrives.

For example, the pack establishes Campus Edge's payroll variance but contains no explanation of its cause. A future payroll/GL feed or attributable operator response could add useful context. The model should cite that new context and preserve its limits; additional data is not automatic proof of causation.

## Existing platform capabilities

Native products already cover substantial accounting and close functionality. RealPage describes close task tracking and workpaper packages; AppFolio advertises agentic accounting under team oversight. These vendor claims support feasibility but limit claims of novelty. The exercise should demonstrate a useful, reliable workflow using the provided data. A real deployment would first assess gaps in the existing licensed platform.

## Primary sources

1. [Buildium accounting guide](https://www.buildium.com/blog/real-estate-accounting-guide-for-property-managers/), published September 14, 2026: monthly reconciliation, property/client funds, categorization, and period locking.
2. [Buildium financial statement workflow](https://www.buildium.com/blog/how-to-generate-financial-statements-in-property-management/), published September 8, 2026: statement types, package preparation, and owner delivery.
3. [Aperto Yardi pre-close checklist](https://media.apts247.info/f0/f014f1adc151467099329315c869e7df/portal/docs/Aperto_Month_End_Pre-Close_Checklist_How_to_Guide_v10.2023.pdf), version October 2023: actual site pre-close tasks and report evidence. Its dates are operator-specific and are not used as the exercise calendar.
4. [Buildium API documentation](https://developer.buildium.com/): GL, bills, budgets, bank/reconciliation resources and configured access requirements.
5. [AppFolio Stack API catalog](https://www.appfolio.com/stack/partners/api): bills, GL/property line items, service dates, linked operational records, and attachments capabilities.
6. [Yardi Data Connect](https://www.yardi.com/en-gb/product/data-connect/): report-based API dataflows and scheduled reporting in the customer's Microsoft environment.
7. [RealPage close-management webcast](https://www.realpage.com/webcasts/close-books-record-time/), April 28, 2022: native close task and workpaper support.
8. [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting), current page checked October 31, 2026: exports and advertised AI accounting functionality. Advertised performance is not independent evidence or Asset Living configuration.

The exercise brief, workbook, and user-provided job description remain the source of interview requirements. No one at Asset Living was contacted and no user accounting systems were accessed.
