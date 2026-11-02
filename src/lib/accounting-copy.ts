/** Plain-language equivalents for legacy system wording. Saved evidence and review history stay unchanged. */
const wording: Record<string, string> = {
  "Matching invoice identifiers, vendor, property, date and amount identify a candidate. Posting, payment and distinct source-transaction identity remain unknown.": "These records might represent the same invoice. The application needs posting and payment evidence before recommending a correction.",
  "Prepare a correction only after verifying the underlying transaction and authorized accounting period.": "Check the original invoice, whether it was posted or paid, and whether the correction is allowed in this accounting period.",
  "The supplied records do not establish the cause.": "The available records do not explain why the amount differs from budget.",
  "Commentary is required for a category strictly more than 10% off budget. The AP register is not established as the full ledger.": "An explanation is required when a category differs from budget by more than 10%. The invoice list may not include everything recorded in the ledger.",
  "The added support is incomplete. Keep the candidate open until transaction state and the correction route are established.": "More information is needed before recommending a correction. Confirm whether the invoice was posted or paid and which correction is allowed.",
  "The coding suggestion requires further source or authorization evidence before an actionable correction can be approved.": "Check the invoice, ledger records and approval authority before approving an account correction.",
  "The policy applies before payment; missing evidence is not a proven payment-policy violation.": "Check that the Regional Manager approved each invoice before payment. Missing approval records do not prove that approval was skipped.",
  "Reported completion is not independent verification and a source discrepancy does not authorize a ledger entry.": "Check the supporting work before confirming completion. A tracker discrepancy alone does not justify a journal entry.",
  "Obtain invoice and source transaction support": "Provide the original invoice and the related accounting records",
  "Confirm posting, payment, entity, period and correction authority": "Confirm whether it was posted or paid, which entity it belongs to, and who may approve the correction",
  "Record the source invoice reference from the supporting invoice": "Enter the invoice number shown on the supporting invoice",
  "Underlying ledger support remains outstanding": "Supporting ledger records are still needed",
  "Request an attributable explanation and supporting ledger detail": "Ask the person responsible for an explanation and supporting ledger records"
};
export function accountingCopy(text: string): string { return wording[text] || text; }
