import { createHash, randomUUID } from "node:crypto";
import type { CaseDetail, Evidence, Proposal, SupportInput } from "../shared/types";
import type { Invoice, ParsedWorkbook } from "./import";
import { exceedsCommentaryThreshold, normalizeInvoice, requiresRegionalApproval } from "./import";

export type ProposalInput = Omit<Proposal, "id" | "version" | "createdAt" | "disposition">;
const money = (cents: number) => new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(cents / 100);
export function history(actor: string, action: string) { return {id: randomUUID(), actor, action, at: new Date().toISOString()}; }
function initialCase(parsed: ParsedWorkbook, key: string, propertyId: string, kind: CaseDetail["kind"], title: string, amountCents: number, facts: Record<string, unknown>, evidence: Evidence[]): CaseDetail {
  const property = parsed.properties.find(p => p.id === propertyId);
  const result: CaseDetail = {
    id: `CASE-${createHash("sha256").update(parsed.summary.id + key).digest("hex").slice(0, 14)}`,
    importId: parsed.summary.id, propertyId, propertyName: property?.name || "Portfolio", kind, title, amountCents,
    status: "candidate", revision: 1, evidenceVersion: 0, nextAction: "Review source evidence", owner: property?.accountant || "Accounting manager",
    facts, evidence, proposals: [], requests: [], execution: null, history: [history("Preparation", "Finding prepared from original workbook records.")],
  };
  const p = buildRuleProposal(result);
  result.proposals.push({...p, id: randomUUID(), version: 1, createdAt: new Date().toISOString(), disposition: "pending"});
  result.nextAction = p.missing[0] || "Review the prepared proposal";
  return result;
}
function originalEvidence(label: string, data: Record<string, unknown>, source: Evidence["source"]): Evidence {
  return {id: `SRC-${createHash("sha256").update(label + JSON.stringify(source)).digest("hex").slice(0, 12)}`, label, kind: "workbook", author: "Original workbook", text: JSON.stringify(data, null, 2), data, source, version: 0, createdAt: new Date().toISOString()};
}
const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "September 2026" → "2026-09", matching ISO invoice dates. */
function periodPrefix(period: string) {
  const [month, year] = period.trim().toLowerCase().split(/\s+/), index = months.indexOf(month);
  return index >= 0 && /^\d{4}$/.test(year || "") ? `${year}-${String(index + 1).padStart(2, "0")}` : null;
}
function relatedInvoiceSentence(c: CaseDetail) {
  const count = c.facts.relatedInvoiceCount;
  if (typeof count !== "number") return "";
  if (!count) return ` The AP register lists no invoices coded to ${c.facts.category} for this property.`;
  const outside = (c.facts.relatedInvoicesOutsidePeriod as unknown[] | undefined)?.length || 0;
  return ` The AP register lists ${count} invoice${count === 1 ? "" : "s"} coded to ${c.facts.category} for this property, totaling ${money(Number(c.facts.relatedInvoiceTotalCents))}${outside ? `; ${outside} ${outside === 1 ? "is" : "are"} dated outside ${c.facts.relatedInvoicePeriod}` : ""}.`;
}
export function codingAccount(invoice: Invoice) {
  const text = `${invoice.vendor} ${invoice.description}`.toLowerCase();
  if (/grounds maintenance|landscap/.test(text)) return "6210";
  if (/water\s*(\/|and|&)\s*sewer|water\/sewer/.test(text)) return "6420";
  if (/gas service/.test(text)) return "6430";
  if (/trash|waste/.test(text)) return "6230";
  if (/office supplies/.test(text)) return "6510";
  if (/advertising/.test(text)) return "5410";
  if (/hvac repair/.test(text)) return "6130";
  if (/unit[\s-]+turn/.test(text)) return "6120";
  return null;
}
export function findCases(parsed: ParsedWorkbook): CaseDetail[] {
  const result: CaseDetail[] = [], groups = new Map<string, Invoice[]>();
  for (const invoice of parsed.invoices) {
    const key = [invoice.propertyId, invoice.vendor.toLocaleLowerCase(), normalizeInvoice(invoice.invoice), invoice.amountCents, invoice.invoiceDate].join("|");
    groups.set(key, [...(groups.get(key) || []), invoice]);
  }
  for (const [key, invoices] of groups) if (invoices.length > 1) {
    const first = invoices[0];
    result.push(initialCase(parsed, `duplicate:${key}`, first.propertyId, "duplicate", `${first.vendor} · duplicate candidate`, first.amountCents * (invoices.length - 1), {invoices, amountMeaning: "One excess record per candidate pair; not confirmed liability or savings.", normalizationRule: "Trim, uppercase and remove one leading INV- prefix for candidate matching only."}, invoices.map(i => originalEvidence(`${i.invoice} · ${i.vendor}`, i as unknown as Record<string, unknown>, i.source))));
  }
  for (const invoice of parsed.invoices) {
    const expectedGL = codingAccount(invoice), account = parsed.accounts.find(a => a.code === expectedGL);
    if (expectedGL && expectedGL !== invoice.gl && account) {
      const currentAccount = parsed.accounts.find(a => a.code === invoice.gl)!;
      result.push(initialCase(parsed, `coding:${invoice.source.row}`, invoice.propertyId, "coding", `${invoice.vendor} · coding review`, invoice.amountCents, {invoice, expectedGL, expectedAccount: account.name, expectedCategory: account.category, currentGL: invoice.gl, currentAccount: currentAccount.name, currentCategory: currentAccount.category, amountMeaning: "Accounting classification under review; not savings."}, [originalEvidence(invoice.invoice, invoice as unknown as Record<string, unknown>, invoice.source), originalEvidence("Chart of accounts", {currentAccount, suggestedAccount: account}, account.source)]));
    }
  }
  const categoryOf = new Map(parsed.accounts.map(a => [a.code, a.category] as const)), period = periodPrefix(parsed.summary.period);
  for (const variance of parsed.variances) if (exceedsCommentaryThreshold(variance.budgetCents, variance.actualCents) && !variance.commentary) {
    const property = parsed.properties.find(p => p.id === variance.propertyId)!;
    const tracker = property.steps.find(s => s.name.toLowerCase().includes("variance"));
    const related = parsed.invoices.filter(i => i.propertyId === variance.propertyId && categoryOf.get(i.gl) === variance.category);
    const relatedTotal = related.reduce((n, i) => n + i.amountCents, 0);
    result.push(initialCase(parsed, `variance:${variance.source.row}`, variance.propertyId, "variance", `${variance.category} · commentary required`, Math.abs(variance.actualCents - variance.budgetCents), {...variance, deltaCents: variance.actualCents - variance.budgetCents, trackerStatus: tracker?.status || "Unknown", amountMeaning: "Budget variance; not a proposed correction.",
      relatedInvoiceCount: related.length, relatedInvoiceTotalCents: relatedTotal, actualLessRelatedInvoicesCents: variance.actualCents - relatedTotal, relatedInvoicePeriod: parsed.summary.period,
      relatedInvoicesOutsidePeriod: related.filter(i => period && !i.invoiceDate.startsWith(period)).map(i => ({invoice: i.invoice, vendor: i.vendor, invoiceDate: i.invoiceDate, amountCents: i.amountCents, row: i.source.row})),
      relatedInvoiceScope: `AP register rows for this property coded to ${variance.category} accounts. The register is not established as the full ledger, so these rows are context rather than the cause.`},
    [originalEvidence("Budget versus actual", variance as unknown as Record<string, unknown>, variance.source), ...(tracker ? [originalEvidence("Variance close step", tracker as unknown as Record<string, unknown>, tracker.source)] : []), ...related.map(i => originalEvidence(`${i.invoice} · ${i.vendor}`, i as unknown as Record<string, unknown>, i.source))]));
  }
  for (const property of parsed.properties) {
    const high = parsed.invoices.filter(i => i.propertyId === property.id && requiresRegionalApproval(i.amountCents));
    if (high.length) result.push(initialCase(parsed, `approval:${property.id}`, property.id, "approval", `Regional approval evidence · ${high.length} invoice${high.length === 1 ? "" : "s"}`, high.reduce((n, i) => n + i.amountCents, 0), {invoices: high, policy: "Invoices strictly over $10,000 require Regional Manager approval before payment.", amountMeaning: "Invoices requiring approver-role evidence; not confirmed violations."}, high.map(i => originalEvidence(i.invoice, i as unknown as Record<string, unknown>, i.source))));
    const late = property.steps.filter(s => s.status === "Late"), conflicts = property.steps.filter(s => s.conflict);
    if (late.length || conflicts.length) result.push(initialCase(parsed, `close:${property.id}`, property.id, "close", conflicts.length ? "Close tracker · conflicting completion" : `Close progress · ${late.length} overdue steps`, 0, {lateSteps: late, conflictingSteps: conflicts, amountMeaning: "Operational close evidence; no financial amount."}, [...new Map([...late, ...conflicts].map(s => [s.source.row, s])).values()].map(s => originalEvidence(s.name, s as unknown as Record<string, unknown>, s.source))));
    if (!property.active) {
      const invoices = parsed.invoices.filter(i => i.propertyId === property.id);
      if (invoices.length) result.push(initialCase(parsed, `offboarded:${property.id}`, property.id, "close", "Offboarded property · invoice responsibility", invoices.reduce((n, i) => n + i.amountCents, 0), {invoices, offboarded: true, amountMeaning: "Responsibility review; an offboarded property may still have valid liabilities."}, invoices.map(i => originalEvidence(i.invoice, i as unknown as Record<string, unknown>, i.source))));
    }
  }
  return result;
}
export function supportOf(c: CaseDetail): SupportInput | null { return (c.facts.support as SupportInput | undefined) || null; }
export function sourceInvoiceReference(c: CaseDetail): string | null {
  if (c.kind === "coding") return String((c.facts.invoice as Invoice | undefined)?.invoice || "") || null;
  if (c.kind === "duplicate") return String((c.facts.invoices as Invoice[] | undefined)?.[0]?.invoice || "") || null;
  return null;
}
export function invoiceIdentityIssue(c: CaseDetail): string | null {
  if (!["coding", "duplicate"].includes(c.kind)) return null;
  const original = sourceInvoiceReference(c), recorded = supportOf(c)?.invoiceReference;
  if (!original) return "Original workbook invoice identity is unavailable";
  if (!recorded?.trim()) return "Record the source invoice reference from the supporting invoice";
  if (normalizeInvoice(recorded) !== normalizeInvoice(original)) return `Resolve the supporting invoice reference mismatch with workbook invoice ${original}`;
  return null;
}
export function codingCategories(c: CaseDetail) {
  const chart = c.evidence.find(e => e.label === "Chart of accounts")?.data;
  return {
    current: String(c.facts.currentCategory || (chart?.currentAccount as {category?: string} | undefined)?.category || ""),
    expected: String(c.facts.expectedCategory || (chart?.suggestedAccount as {category?: string} | undefined)?.category || ""),
  };
}
export function needsAccountingTreatmentReview(c: CaseDetail) {
  if (c.kind !== "coding") return false;
  const categories = codingCategories(c);
  const isCapital = (category: string) => /\b(capex|capital|asset|balance sheet)\b/i.test(category);
  return !categories.current || !categories.expected || isCapital(categories.current) || isCapital(categories.expected);
}
export function buildRuleProposal(c: CaseDetail): ProposalInput {
  const s = supportOf(c), missing: string[] = [], sources = c.evidence.filter(e => e.version === 0 || e.version === c.evidenceVersion).map(e => e.id);
  const p: ProposalInput = {evidenceVersion: c.evidenceVersion, route: "Evidence review", summary: "", rationale: "", missing, sources, journal: [], origin: "rules"};
  if (c.kind === "variance") {
    const budget = Number(c.facts.budgetCents), actual = Number(c.facts.actualCents), delta = actual - budget;
    const percent = budget ? `${(Math.abs(delta) / Math.abs(budget) * 100).toFixed(1)}%` : "an undefined percentage on zero budget";
    p.route = "Commentary review";
    p.summary = `${c.facts.category} actual is ${money(actual)} against ${money(budget)} budget, ${money(Math.abs(delta))} ${delta >= 0 ? "unfavorable" : "favorable"} (${percent}).${relatedInvoiceSentence(c)} ${s?.explanation ? `The staff explanation attributes the variance as follows: ${s.explanation}` : "The available records do not explain why the amount differs from budget."}`;
    p.rationale = "An explanation is required when a category differs from budget by more than 10%. The invoice list may not include everything recorded in the ledger.";
    if (!s?.explanation) missing.push("Request an attributable explanation and supporting ledger detail");
    if (!s?.ledgerRecord) missing.push("Underlying ledger support remains outstanding");
    return p;
  }
  if (c.kind === "approval") {
    p.summary = `${(c.facts.invoices as Invoice[]).length} invoices exceed $10,000. The workbook does not show who approved them or whether they were paid.`;
    p.rationale = "Check that the Regional Manager approved each invoice before payment. Missing approval records do not prove that approval was skipped.";
    const invoices = c.facts.invoices as Invoice[], records = s?.approvalRecords || [];
    for (const invoice of invoices) {
      const record = records.find(r => r.invoiceRow === invoice.source.row);
      if (!record || record.approverRole !== "Regional Manager" || !record.reference.trim() || !record.approvedBeforePayment) missing.push(`Obtain Regional Manager approval before-payment evidence for ${invoice.invoice} · ${invoice.vendor}`);
    }
    if (!missing.length) p.summary = `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} now have source-referenced Regional Manager approval records identifying sign-off before payment. The manager reviews this evidence; this does not release a payment.`;
    return p;
  }
  if (c.kind === "close") {
    p.summary = c.facts.offboarded ? "These invoices belong to a property we no longer manage. Check when the services were provided and who is responsible for payment." : "The close tracker shows overdue work or completion dates after business day 6. Ask the accountant to confirm what is complete and provide supporting workpapers.";
    p.rationale = "Check the supporting work before confirming completion. A tracker discrepancy alone does not justify a journal entry.";
    const affected = [...((c.facts.lateSteps as {name: string}[]) || []), ...((c.facts.conflictingSteps as {name: string}[]) || [])];
    if (c.facts.offboarded) missing.push("Confirm service-period and owner-responsibility support");
    else for (const step of [...new Map(affected.map(step => [step.name, step])).values()]) {
      const record = s?.closeRecords?.find(r => r.step === step.name);
      if (!record || record.completedBD > 6 || record.completedBD < 1 || !record.reference.trim()) missing.push(`Confirm ${step.name} completed by BD6 with a workpaper reference`);
    }
    if (!missing.length) p.summary = "Updated work records identify completion by BD6 and supporting references for the affected steps. Review the supporting work and resolve this issue separately from the original imported tracker.";
    return p;
  }
  if (needsAccountingTreatmentReview(c)) {
    const categories = codingCategories(c);
    p.route = "Accounting treatment review";
    p.summary = `The source account is ${c.facts.currentGL} ${c.facts.currentAccount}${categories.current ? ` (${categories.current})` : ""}; the description suggests reviewing ${c.facts.expectedGL} ${c.facts.expectedAccount}${categories.expected ? ` (${categories.expected})` : ""}. Check the accounting policy before deciding which account to use.`;
    p.rationale = categories.current && categories.expected ? "Capitalization or expensing can change assets, expenses and subsequent depreciation. A generic expense-reclass permission does not establish the correct treatment." : "Confirm the account classifications and supported accounting treatment before preparing a correction.";
    missing.push(categories.current && categories.expected ? "Obtain capitalization policy and a supported accounting-treatment decision" : "Confirm asset/expense account classifications and treatment policy");
    const identityIssue = invoiceIdentityIssue(c);if (identityIssue) missing.push(identityIssue);
    if (!s?.invoiceRecord || !s?.ledgerRecord) missing.push("Obtain the original invoice and posted ledger support");
    return p;
  }
  if (!s) {
    p.summary = c.kind === "duplicate" ? "These records might represent the same invoice. The application needs posting and payment evidence before recommending a correction." : `The description suggests ${c.facts.expectedAccount}, but this invoice is coded to ${c.facts.currentAccount}. Check the invoice and ledger before deciding whether to change the account.`;
    p.rationale = "Check the original invoice, whether it was posted or paid, and whether the correction is allowed in this accounting period.";
    missing.push("Obtain invoice and source transaction support", "Confirm posting, payment, entity, period and correction authority");
    const identityIssue = invoiceIdentityIssue(c);if (identityIssue) missing.push(identityIssue);
    return p;
  }
  const identityIssue = invoiceIdentityIssue(c);if (identityIssue) missing.push(identityIssue);
  if (!s.invoiceRecord.trim()) missing.push("Original invoice support is required");
  if (!s.transactionId.trim()) missing.push("Source transaction ID is required");
  if (!s.entity.trim()) missing.push("Property/legal entity must be confirmed");
  if (s.postingState === "unknown") missing.push("Posting state is unknown");
  if (s.paymentState === "unknown" || !s.paymentRecord.trim()) missing.push("Payment and scheduled-payment evidence is required");
  if (!s.policyRecord.trim() || !s.correctionAuthorized) missing.push("Confirm correction authority and policy");
  if (!s.periodOpen) missing.push("Confirm an authorized correction period");
  if (s.postingState === "posted" && !s.ledgerRecord.trim()) missing.push("Posted ledger support is required");
  if (c.kind === "duplicate") {
    if (!s.duplicateConfirmed) missing.push("Confirm that two source records represent one obligation");
    if (!s.retainedTransactionId || s.retainedTransactionId === s.transactionId) missing.push("Identify the distinct valid transaction to retain");
    if (s.paymentState === "scheduled") { p.route = "Payment review"; missing.push("Confirm payment cancellation before correcting the payable"); }
    else if (s.paymentState === "paid") { p.route = "Recovery review"; missing.push("Obtain settlement and vendor credit/refund recovery support"); }
    else if (s.postingState === "unposted") p.route = "Invoice rejection";
    else if (s.postingState === "posted") p.route = "AP reversal";
    p.summary = missing.length ? "More information is needed before recommending a correction. Confirm whether the invoice was posted or paid and which correction is allowed." : p.route === "Invoice rejection" ? `Reject extra unposted invoice ${s.transactionId}; retain ${s.retainedTransactionId}. No standalone JE is required.` : `Reverse extra bill ${s.transactionId} through AP; retain ${s.retainedTransactionId}. Both are unpaid and unscheduled according to the payment support.`;
    p.rationale = "A correction through AP keeps the vendor bill and GL aligned. A manual GL-only reversal does not stop a payment or remove an outstanding source bill.";
  } else {
    if (s.paymentState === "scheduled" || s.paymentState === "paid") missing.push("Accounting treatment for the payment state requires further review");
    p.route = s.postingState === "unposted" ? "Invoice recoding" : "Expense reclassification";
    p.summary = missing.length ? "Check the invoice, ledger records and approval authority before approving an account correction." : s.postingState === "unposted" ? `Recode invoice ${s.transactionId} from ${c.facts.currentGL} to ${c.facts.expectedGL} and repeat required approval.` : `Reclassify ${money(c.amountCents)} within ${s.entity}: debit ${c.facts.expectedGL} ${c.facts.expectedAccount}; credit ${c.facts.currentGL} ${c.facts.currentAccount}.`;
    p.rationale = "This is an expense classification change within the confirmed property/entity. Total expense, AP and cash do not change. Execute one authorized correction route, not both an AP reclass and a manual JE.";
    if (!missing.length && s.postingState === "posted") p.journal = [
      {account: String(c.facts.expectedGL), name: String(c.facts.expectedAccount), debitCents: c.amountCents, creditCents: 0},
      {account: String(c.facts.currentGL), name: String(c.facts.currentAccount), debitCents: 0, creditCents: c.amountCents},
    ];
  }
  return p;
}
export function executionTemplate(c: CaseDetail): Record<string, unknown> | null {
  const p = c.proposals[c.proposals.length - 1], s = supportOf(c);
  if (!p || !s || p.disposition !== "approved" || p.evidenceVersion !== c.evidenceVersion || needsAccountingTreatmentReview(c) || invoiceIdentityIssue(c)) return null;
  const common = {recordSource: "REFRESHED-LEDGER-01", targetId: s.transactionId, amountCents: c.amountCents, ledgerMatched: true, cashChangeCents: 0};
  if (p.route === "AP reversal") return {...common, reversedBalanceCents: 0, retainedId: s.retainedTransactionId, retainedBalanceCents: c.amountCents, apChangeCents: -c.amountCents, expenseChangeCents: -c.amountCents};
  if (p.route === "Expense reclassification") return {...common, debitAccount: String(c.facts.expectedGL), creditAccount: String(c.facts.currentGL), debitCents: c.amountCents, creditCents: c.amountCents, apChangeCents: 0};
  return {...common, sourceState: p.route === "Invoice rejection" ? "rejected" : "recoded", targetAccount: c.facts.expectedGL || null, retainedId: s.retainedTransactionId || null};
}
