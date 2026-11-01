import { createHash } from "node:crypto";
import type { AiUsage, AmountReview, Attention, CaseDetail, CommentaryDiscrepancy, CommentaryReviewState, SourceRef, StageMatrix, ThresholdReview } from "../shared/types";
import { exceedsCommentaryThreshold, type Invoice, type ParsedWorkbook, type Variance } from "./import";

/** Invoices are compared with at least this many others sharing a description; above this many robust deviations they are flagged. */
export const AMOUNT_REVIEW = { minPeers: 8, robustDeviations: 5 } as const;
const COMMENTARY_THRESHOLD_PERCENT = 10;
const closedStatuses = new Set(["resolved", "dismissed"]);
const openStatuses = new Set(["candidate", "awaiting_evidence", "ready"]);
const reported = (status: string) => status.trim().toLowerCase();
const isLate = (status: string) => reported(status) === "late";
const isComplete = (status: string) => reported(status) === "complete";
const isVarianceStep = (name: string) => name.toLowerCase().includes("variance");
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function requiredCommentaryRows(parsed: ParsedWorkbook): Variance[] {
  return parsed.variances.filter(v => exceedsCommentaryThreshold(v.budgetCents, v.actualCents) && !v.commentary.trim());
}
function varianceCase(cases: CaseDetail[], row: Variance) {
  return cases.find(c => c.kind === "variance" && c.propertyId === row.propertyId && (c.facts.source as SourceRef | undefined)?.row === row.source.row);
}
export function commentaryReview(c: CaseDetail | undefined): CommentaryReviewState {
  if (c?.status === "resolved") return "resolved";
  if (c?.status === "dismissed") return "dismissed";
  return c?.proposals.at(-1)?.disposition === "approved" ? "wording_accepted" : "missing";
}

/** Unusually high invoices relative to the other invoices sharing a description, using a leave-one-out median and median absolute deviation. */
export function findAmountReviews(parsed: ParsedWorkbook, cases: CaseDetail[] = []): AmountReview[] {
  const groups = new Map<string, Invoice[]>();
  for (const invoice of parsed.invoices) {
    const key = invoice.description.trim().toLowerCase().replace(/\s+/g, " ");
    if (key) groups.set(key, [...(groups.get(key) || []), invoice]);
  }
  const owners = new Map(parsed.properties.map(p => [p.id, p.accountant] as const));
  const reviews: AmountReview[] = [];
  for (const invoices of groups.values()) {
    if (invoices.length <= AMOUNT_REVIEW.minPeers) continue;
    for (const invoice of invoices) {
      const peers = invoices.filter(other => other !== invoice).map(other => other.amountCents);
      const center = median(peers), spread = median(peers.map(value => Math.abs(value - center)));
      if (center <= 0 || spread <= 0 || 0.6745 * (invoice.amountCents - center) / spread <= AMOUNT_REVIEW.robustDeviations) continue;
      const approvalCase = cases.find(c => c.kind === "approval" && c.propertyId === invoice.propertyId && (c.facts.invoices as Invoice[] | undefined)?.some(i => i.source.row === invoice.source.row));
      reviews.push({
        invoice: invoice.invoice, vendor: invoice.vendor, propertyId: invoice.propertyId, propertyName: invoice.propertyName, description: invoice.description, gl: invoice.gl,
        amountCents: invoice.amountCents, invoiceDate: invoice.invoiceDate, receivedDate: invoice.receivedDate, approval: invoice.approval, codedBy: invoice.codedBy, source: invoice.source,
        peerCount: peers.length, peerMedianCents: Math.round(center), peerLowCents: Math.min(...peers), peerHighCents: Math.max(...peers),
        multiple: Math.round(invoice.amountCents / center * 10) / 10, owner: owners.get(invoice.propertyId) || "Unassigned", approvalCaseId: approvalCase?.id || null, status: "outstanding",
      });
    }
  }
  return reviews.sort((a, b) => b.amountCents - a.amountCents);
}

/** Workbook facts combined with current review state. The imported tracker itself is never rewritten. */
export function computeAttention(parsed: ParsedWorkbook, cases: CaseDetail[]): Attention {
  const active = parsed.properties.filter(p => p.active), required = requiredCommentaryRows(parsed);
  const closeClosed = (propertyId: string) => cases.some(c => c.kind === "close" && c.propertyId === propertyId && !c.facts.offboarded && closedStatuses.has(c.status));
  const overdue = active.filter(p => p.steps.some(s => isLate(s.status)) && !closeClosed(p.id)).map(p => p.id);
  const commentary = active.filter(p => required.some(v => v.propertyId === p.id && !closedStatuses.has(varianceCase(cases, v)?.status || ""))).map(p => p.id);
  const discrepancies: CommentaryDiscrepancy[] = active.flatMap(p => {
    const step = p.steps.find(s => isVarianceStep(s.name)), rows = required.filter(v => v.propertyId === p.id);
    if (!step || !isComplete(step.status) || !rows.length) return [];
    return [{
      propertyId: p.id, propertyName: p.name, accountant: p.accountant,
      step: { status: step.status, dueBD: step.dueBD, completedBD: step.completedBD, source: step.source },
      categories: rows.map(v => { const c = varianceCase(cases, v); return { category: v.category, budgetCents: v.budgetCents, actualCents: v.actualCents, caseId: c?.id || null, review: commentaryReview(c), source: v.source }; }),
    }];
  });
  const thresholdReviews: ThresholdReview[] = active.flatMap(p => {
    const step = p.steps.find(s => isVarianceStep(s.name)), rows = parsed.variances.filter(v => v.propertyId === p.id);
    if (!step || isComplete(step.status) || step.dueBD > parsed.summary.asOfBD || !rows.length || rows.some(v => exceedsCommentaryThreshold(v.budgetCents, v.actualCents))) return [];
    return [{ propertyId: p.id, propertyName: p.name, accountant: p.accountant, dueBD: step.dueBD, status: step.status, source: step.source }];
  });
  const reviews = findAmountReviews(parsed, cases), pending = reviews.filter(r => reported(r.approval) === "pending");
  return {
    followUp: { propertyIds: active.filter(p => overdue.includes(p.id) || commentary.includes(p.id)).map(p => p.id), overdue, commentary },
    commentary: { discrepancies, awaitingWording: discrepancies.filter(d => d.categories.some(c => c.review === "missing")).length, thresholdReviews, dateConflicts: active.filter(p => p.steps.some(s => s.conflict)).map(p => p.id) },
    amounts: { reviews, totalCents: sum(reviews.map(r => r.amountCents)), pendingCount: pending.length, pendingCents: sum(pending.map(r => r.amountCents)), ...AMOUNT_REVIEW },
  };
}

/** Overdue tracker steps by accountant and stage for steps due before the snapshot day. */
export function stageMatrix(parsed: ParsedWorkbook): StageMatrix {
  const asOfBD = parsed.summary.asOfBD, active = parsed.properties.filter(p => p.active && p.steps.length);
  const dueDay = new Map<string, number>();
  for (const p of active) for (const s of p.steps) if (s.dueBD < asOfBD && !dueDay.has(s.name)) dueDay.set(s.name, s.dueBD);
  const names = [...dueDay.keys()].sort((a, b) => dueDay.get(a)! - dueDay.get(b)!);
  const rows = [...new Set(active.map(p => p.accountant))].map(accountant => {
    const properties = active.filter(p => p.accountant === accountant);
    const cells = names.map(name => { const steps = properties.flatMap(p => p.steps.filter(s => s.name === name)); return { overdue: steps.filter(s => isLate(s.status)).length, due: steps.length }; });
    return { accountant, properties: properties.length, overdue: sum(cells.map(c => c.overdue)), due: sum(cells.map(c => c.due)), cells };
  }).sort((a, b) => b.overdue - a.overdue || a.accountant.localeCompare(b.accountant));
  const stages = names.map((name, i) => ({ name, dueBD: dueDay.get(name)!, overdue: sum(rows.map(r => r.cells[i].overdue)), due: sum(rows.map(r => r.cells[i].due)) }));
  return { asOfBD, stages, rows, overdue: sum(rows.map(r => r.overdue)), due: sum(rows.map(r => r.due)) };
}

/** AI case-draft outcomes. Every generated draft lands in exactly one bucket. */
export function aiUsage(cases: CaseDetail[]): AiUsage {
  const usage: AiUsage = { generated: 0, approved: 0, returned: 0, pending: 0, superseded: 0 };
  for (const c of cases) c.proposals.forEach((proposal, index) => {
    if (proposal.origin !== "ai") return;
    usage.generated++;
    if (proposal.disposition === "approved") usage.approved++;
    else if (proposal.disposition === "returned") usage.returned++;
    else if (index === c.proposals.length - 1 && openStatuses.has(c.status)) usage.pending++;
    else usage.superseded++;
  });
  return usage;
}

/** Computed facts and permitted link targets for the priorities briefing. */
export function briefingInput(parsed: ParsedWorkbook, cases: CaseDetail[], attention = computeAttention(parsed, cases), matrix = stageMatrix(parsed)) {
  const names = new Map(parsed.properties.map(p => [p.id, p.name] as const));
  const openOverdue = new Set(attention.followUp.overdue);
  const lateSteps = (propertyId: string) => parsed.properties.find(p => p.id === propertyId)?.steps.filter(s => isLate(s.status)).length || 0;
  const withOverdue = matrix.rows.filter(r => r.overdue > 0), [largest, ...others] = withOverdue;
  const stageCounts = (rows: typeof matrix.rows) => Object.fromEntries(matrix.stages.map((s, i) => [s.name, sum(rows.map(r => r.cells[i].overdue))] as const).filter(([, n]) => n > 0));
  const reviewLabel: Record<CommentaryReviewState, string> = { missing: "No accepted wording", wording_accepted: "Wording accepted; support outstanding", resolved: "Resolved", dismissed: "Dismissed" };
  const facts = {
    period: parsed.summary.period, asOfBD: parsed.summary.asOfBD, ownerReportDueBD: Math.max(...parsed.properties.flatMap(p => p.steps.map(s => s.dueBD))), commentaryThresholdPercent: COMMENTARY_THRESHOLD_PERCENT,
    followUp: { properties: attention.followUp.propertyIds.length, withOpenOverdueSteps: attention.followUp.overdue.length, withRequiredCommentaryOutstanding: attention.followUp.commentary.length, withBoth: attention.followUp.overdue.filter(id => attention.followUp.commentary.includes(id)).length },
    overdueSteps: {
      basis: `Tracker status as of business day ${parsed.summary.asOfBD}. Review activity does not rewrite the imported tracker.`,
      total: matrix.overdue, dueBeforeSnapshot: matrix.due,
      byStage: matrix.stages.filter(s => s.overdue > 0).map(s => ({ stage: s.name, overdue: s.overdue, due: s.due })),
      byAccountantPortfolio: withOverdue.map(r => ({
        accountant: r.accountant, properties: r.properties, overdue: r.overdue, dueBeforeSnapshot: r.due, overduePercent: Math.round(r.overdue / r.due * 100), byStage: stageCounts([r]),
        openPropertiesByOverdueSteps: parsed.properties.filter(p => p.accountant === r.accountant && openOverdue.has(p.id)).map(p => ({ propertyId: p.id, property: p.name, overdueSteps: lateSteps(p.id) })).sort((a, b) => b.overdueSteps - a.overdueSteps || a.property.localeCompare(b.property)),
      })),
      outsideLargestPortfolio: largest ? { excludes: largest.accountant, overdue: sum(others.map(r => r.overdue)), byStage: stageCounts(others) } : null,
    },
    commentary: {
      markedCompleteWithoutRequiredCommentary: attention.commentary.discrepancies.map(d => ({ propertyId: d.propertyId, property: d.propertyName, trackerStatus: d.step.status, trackerCompletedBD: d.step.completedBD, categories: d.categories.map(c => ({ category: c.category, reviewState: reviewLabel[c.review] })) })),
      awaitingAcceptedWording: attention.commentary.awaitingWording,
      thresholdReviewsDue: { count: attention.commentary.thresholdReviews.length, note: "No category at these properties exceeds the commentary threshold. Each needs a confirmed threshold review, not new commentary." },
      completionDateConflicts: attention.commentary.dateConflicts.length,
    },
    amountVerification: { flaggedInvoices: attention.amounts.reviews.length, pendingApproval: attention.amounts.pendingCount, pendingAmount: money(attention.amounts.pendingCents), flaggedAmount: money(attention.amounts.totalCents), status: "Amount verification outstanding. No payment hold is recorded by this application." },
  };
  const links: Record<string, string> = { followup: "Properties needing close follow-up", overdue: "Properties with overdue steps", commentary: "Variance commentary cases", threshold: "Threshold reviews due", amounts: "Invoices flagged for amount verification" };
  for (const r of withOverdue) links[`accountant:${r.accountant}`] = `${r.accountant} portfolio`;
  for (const s of matrix.stages.filter(s => s.overdue > 0)) links[`stage:${s.name}`] = `Overdue ${s.name}`;
  for (const id of new Set([...attention.followUp.propertyIds, ...attention.commentary.discrepancies.map(d => d.propertyId)])) links[`property:${id}`] = names.get(id) || id;
  const fingerprint = createHash("sha256").update(JSON.stringify({ facts, links })).digest("hex");
  return { importId: parsed.summary.id, facts, links, fingerprint };
}
