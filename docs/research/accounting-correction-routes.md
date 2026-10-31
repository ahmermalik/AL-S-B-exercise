# Accounting correction routes

Research and design recommendation, October 31, 2026. The user challenged whether duplicate candidates and coding errors should produce journal entries, then accepted adding the Proposed correction panel and using Sunset Ridge for the walkthrough (D010/D011). The revised conceptual Screen 3 was accepted in D012. Correction workpapers with conditional JE drafts are accepted direction; no accounting integration is implemented.

## Recommendation

Prepare a correction workpaper when an issue is substantiated. Prepare a standalone journal-entry draft only when the transaction state, evidence, and company policy support that remedy. An AP correction can generate its own GL entries; it is not equivalent to entering a separate manual journal.

The exercise identifies both the Property Accounting Manager and staff accountants as users. Its suggested AP assistant surfaces invoices needing human review before payment or posting. Agent-led preparation can remove much of the searching and drafting while staff accountants verify facts and execute authorized corrections, and the manager reviews the proposed treatment within delegated authority.

## Route by confirmed transaction state

| Established condition | Proposed route | Standalone JE? |
| --- | --- | --- |
| Two export rows represent one source transaction | Correct the import interpretation; retain original rows and provenance. | No accounting entry. |
| Similar identifiers represent separate valid obligations | Retain both and document distinguishing support. | No. |
| Confirmed duplicate is still an unposted invoice | Reject/cancel the duplicate in the invoice workflow, with a reason. | Normally no. |
| Confirmed duplicate is a posted unpaid bill | Use the authorized AP reversal, void, or adjustment supported by the accounting system. Preserve audit history. | Not the default; AP should update the bill/vendor record and GL together. |
| A suspected duplicate is scheduled for payment | Request urgent review by the authorized AP/payment owner; establish whether the payment can be stopped. | A JE does not stop a payment. |
| A duplicate has been paid | Establish settlement status; investigate supported payment reversal or vendor credit/refund recovery and associated bill correction. Reconcile AP and cash as affected. | Depends on the supported recovery/correction workflow; never infer that cash has returned. |
| Wrong expense account on an editable, unposted invoice | Correct source coding and repeat required approval. | Normally no. |
| Wrong expense account on a posted invoice | Prefer supported source-system reclassification where permitted; otherwise prepare a policy-approved expense reclass in the correct period. | Potentially, after evidence and authority checks. |
| Wrong property/legal entity, capitalization question, or closed period | Obtain the accounting treatment and authorized period; these need more judgment than a simple expense-account change. | Do not generate an unconditional entry. |

This table is a recommended operating design informed by vendor documentation. It is not Asset Living policy or a guarantee that a particular accounting system supports each operation. Do not prescribe reopening a period or backdating a correction without the company's policy and authorization.

## Supplied evidence and limits

The supplied workbook is `Asset Living Build Exercise - Data Pack_updated (1).xlsx` in the user's Downloads folder.

- B2 contains invoice number, vendor, property, GL code, description, amount, invoice/receipt dates, approval status, and coder. It does not contain posting status, source accounting transaction IDs, payment/settlement state, posting period, invoice images, or journal approval authority. Approved does not establish posted, paid, or approval by a particular role.
- Sunset Ridge B2 rows 15/296 contain `INV-88241` and `88241`, with matching vendor, property, date, and 5,017.79 amount. Rows 34/186 contain another matching pair for 502.34. These are candidates requiring investigation, not confirmed duplicate liabilities or payments.
- Preserve raw identifiers. A documented normalization rule can help find candidates; never assume any arbitrary prefix such as `INT-` is meaningless. Do not remove records or make an accounting correction from the normalized number alone.
- The README A18 payment policy requires Regional Manager approval for invoices strictly greater than 10,000 before payment. It does not define journal-entry approval authority. The other supplied policy requires commentary for categories strictly more than 10% off budget.
- B3 is a separate budget/actual snapshot. Do not subtract candidate invoice amounts from its actuals or claim a corrected owner report without refreshed, reconciled accounting evidence.

## Conditional Sunset Ridge reclassification example

B2 row 424: Lone Star Lawn Co., Monthly grounds maintenance, 2,214.16, coded 6410 Electric. B1 rows 7 and 12 identify 6210 Landscaping and 6410 Electric. These support a coding-review suggestion; the original invoice and accounting policy are still needed.

If the full amount was actually posted to Electric for the same property/entity, the invoice supports landscaping treatment, and the period and correction route are authorized, an expense reclassification could be:

| Account | Debit | Credit |
| --- | ---: | ---: |
| 6210 Landscaping | 2,214.16 | |
| 6410 Electric | | 2,214.16 |

Under those assumptions, total expense, cash, and AP do not change; expense classification changes. This is not savings or budget reallocation. If unposted, correct the invoice instead. Do not execute both an AP reclassification and a separate JE for the same correction.

## Accepted Screen 3 direction

The user selected the Proposed correction section within Case review. Its detailed workflow is illustrated in the [revised Sunset Ridge walkthrough](../screens/case-review.md):

1. Show the issue, source rows, matching/coding rationale, and what is still unconfirmed.
2. Request the underlying invoice, source transaction IDs, ledger posting, payment state, period, and policy/authority needed for this case.
3. Prepare a typed proposal: import correction, invoice rejection, AP correction request, payment review/recovery, or conditional reclassification. Show JE lines only when supported, with explicit prerequisites.
4. Let the manager request evidence, dismiss with a reason, return the proposal, or approve the proposed action within delegated authority. Separate that decision from payment release and execution.
5. Have the accountant or authorized AP owner execute in the source system. Record the correction reference and updated evidence.
6. Verify the affected bill/vendor, GL, and bank records as applicable before resolving the issue. Refresh impacted actuals/commentary and reassess relevant close tasks; do not silently change the original snapshot.

Missing transaction state should produce Posting/payment verification required, not an executable reversal entry. Manager approval means approved for correction, not corrected. Requests stay internal in the prototype; no email, payment hold, or accounting write is implied.

Code owns matching arithmetic, account validity, balanced JE checks, provenance, and version/state gates. The LLM helps interpret descriptions and supplied support, explain alternatives, draft evidence requests, and revise a proposal. It does not infer settlement, invent approval policy, choose an unsupported posting date, or certify accounting correctness.

## Research basis

- [Yardi Breeze invoice workflow](https://www.yardibreeze.com/blog/2026/06/ai-invoice-processing/), June 8, 2026: AI intake feeds existing approvals; invoice approval and payment release are separate; rejected invoices do not become payables, and correctable issues return through entry and approval.
- [Sage 300: journal entries generated by AP](https://help.sage300.com/en-us/2024/classic/Subsystems/AP_2024/Content/Transactions/JournalEntriesGeneratedByAP.htm): invoices, credits, payments, and adjustments create corresponding GL entries.
- [Sage: reconcile AP to GL](https://us-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=222924250017912&view=print): recommends processing AP-control transactions through AP and reconciling before month close. The risk that a GL-only correction leaves an underlying bill unresolved is an inference from this guidance and the AP lifecycle.
- [Sage Intacct: edit a paid bill](https://www.intacct.com/ia/docs/en_US/help_action/Accounts_Payable/Bills/Edit_bills/edit-a-paid-bill.htm), modified October 23, 2026: coding reclassification depends on permissions, configuration, and an open period; overpayments use adjustments/vendor credits; closed periods need separate treatment. Specific mechanics are product-dependent.

These sources establish credible workflow patterns. Asset Living's actual software, accounting basis, owner requirements, correction permissions, and period policy remain unknown.
