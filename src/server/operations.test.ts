import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { CaseDetail } from "../shared/types";
import { buildRuleProposal, findCases } from "./domain";
import { parseWorkbook, type ParsedWorkbook } from "./import";
import { aiUsage, briefingInput, computeAttention, findAmountReviews, stageMatrix } from "./operations";

let parsed: ParsedWorkbook, cases: CaseDetail[];
const variance = (propertyId: string) => cases.find(c => c.kind === "variance" && c.propertyId === propertyId)!;
beforeAll(async () => {
  parsed = await parseWorkbook(readFileSync("seed/close-pack.xlsx"), "close-pack.xlsx");
  cases = findCases(parsed);
});

describe("operational attention facts from the supplied workbook", () => {
  it("counts distinct properties needing close follow-up without double counting", () => {
    const { followUp } = computeAttention(parsed, cases);
    expect(followUp.propertyIds).toHaveLength(18);
    expect(followUp.overdue).toHaveLength(14);
    expect(followUp.commentary.sort()).toEqual(["P103", "P107", "P109", "P114", "P121", "P126"]);
    expect(followUp.overdue.filter(id => followUp.commentary.includes(id)).sort()).toEqual(["P103", "P121"]);
  });

  it("separates Complete-but-missing commentary, threshold reviews and future-dated completions", () => {
    const { commentary } = computeAttention(parsed, cases);
    expect(commentary.discrepancies.map(d => d.propertyId).sort()).toEqual(["P103", "P107", "P109", "P114", "P121", "P126"]);
    expect(commentary.discrepancies.every(d => d.step.status === "Complete" && d.categories.every(c => c.review === "missing" && c.caseId))).toBe(true);
    expect(commentary.awaitingWording).toBe(6);
    expect(commentary.thresholdReviews.map(t => t.propertyId).sort()).toEqual(["P111", "P113", "P115", "P117", "P120", "P122", "P133", "P134", "P140"]);
    expect(commentary.thresholdReviews.every(t => t.status === "Due Today")).toBe(true);
    expect(commentary.dateConflicts.sort()).toEqual(["P103", "P104", "P112"]);
  });

  it("flags the seven unusually high invoices, including one outside every case", () => {
    const reviews = findAmountReviews(parsed, cases);
    expect(reviews.map(r => r.source.row).sort((a, b) => a - b)).toEqual([13, 29, 116, 117, 137, 310, 336]);
    const outside = reviews.find(r => r.source.row === 336)!;
    expect(outside).toMatchObject({ amountCents: 671630, approval: "Approved", approvalCaseId: null, status: "outstanding" });
    expect(reviews.filter(r => r.source.row !== 336).every(r => r.approvalCaseId)).toBe(true);
    const cleaning = reviews.find(r => r.source.row === 137)!;
    expect(cleaning.peerCount).toBe(20); expect(cleaning.multiple).toBeGreaterThan(19);
    const { amounts } = computeAttention(parsed, cases);
    expect(amounts).toMatchObject({ totalCents: 16595014, pendingCount: 6, pendingCents: 15923384 });
  });

  it("separates the concentrated portfolio from the bank-reconciliation pattern", () => {
    const matrix = stageMatrix(parsed);
    expect(matrix.stages.map(s => s.name)).toEqual(["Bank reconciliation", "AP cutoff & accruals", "Rent/AR reconciliation", "Payroll allocation", "Prepaid & deposit roll"]);
    expect(matrix).toMatchObject({ overdue: 36, due: 190 });
    const [largest, ...others] = matrix.rows;
    expect(largest).toMatchObject({ accountant: "J. Ramirez", properties: 9, overdue: 31, due: 45 });
    expect(largest.cells.every(cell => cell.overdue > 0)).toBe(true);
    expect(others.reduce((n, r) => n + r.overdue, 0)).toBe(5);
    expect(others.every(r => r.cells.slice(1).every(cell => cell.overdue === 0))).toBe(true);
    expect(matrix.stages[0]).toMatchObject({ overdue: 12 });
  });

  it("updates review state when wording is accepted without rewriting the tracker or clearing support gaps", () => {
    const reviewed = structuredClone(cases), c = reviewed.find(x => x.kind === "variance" && x.propertyId === "P114")!;
    c.proposals.at(-1)!.disposition = "approved"; c.status = "awaiting_evidence";
    const attention = computeAttention(parsed, reviewed);
    expect(attention.commentary.awaitingWording).toBe(5);
    expect(attention.commentary.discrepancies.find(d => d.propertyId === "P114")?.categories[0].review).toBe("wording_accepted");
    expect(attention.followUp.commentary).toContain("P114");
    expect(attention.commentary.discrepancies.find(d => d.propertyId === "P114")?.step.status).toBe("Complete");
    c.status = "resolved";
    expect(computeAttention(parsed, reviewed).followUp.commentary).not.toContain("P114");
  });
});

describe("variance cases grounded in related workbook invoices", () => {
  it("attaches the category's invoices, including the out-of-period grounds invoice, as evidence", () => {
    const c = variance("P114");
    expect(c.facts).toMatchObject({ relatedInvoiceCount: 4, relatedInvoiceTotalCents: 790554, actualLessRelatedInvoicesCents: Number(c.facts.actualCents) - 790554 });
    expect(c.facts.relatedInvoicesOutsidePeriod).toEqual([expect.objectContaining({ invoice: "INV-89429", invoiceDate: "2026-08-16", row: 389 })]);
    expect(c.evidence.some(e => e.source?.row === 389)).toBe(true);
    expect(buildRuleProposal(c).summary).toContain("1 is dated outside September 2026");
    expect(buildRuleProposal(c).summary).toContain("do not establish the cause");
  });
  it("states plainly when no invoices are coded to the category", () => {
    const c = variance("P107");
    expect(c.facts).toMatchObject({ relatedInvoiceCount: 0, relatedInvoiceTotalCents: 0 });
    expect(c.evidence.filter(e => e.source?.sheet.startsWith("B2"))).toHaveLength(0);
    expect(buildRuleProposal(c).summary).toContain("lists no invoices coded to Utilities");
  });
});

describe("briefing inputs and usage", () => {
  it("offers only link targets that exist in the computed facts and changes fingerprint with review state", () => {
    const input = briefingInput(parsed, cases);
    expect(input.links["accountant:J. Ramirez"]).toBeDefined();
    expect(input.links["stage:Bank reconciliation"]).toBeDefined();
    expect(input.links["property:P104"]).toBe("The Grove at Kingwood");
    expect(input.links["stage:Variance commentary"]).toBeUndefined();
    expect(input.facts.overdueSteps.outsideLargestPortfolio).toEqual({ excludes: "J. Ramirez", overdue: 5, byStage: { "Bank reconciliation": 5 } });
    const reviewed = structuredClone(cases); reviewed.find(x => x.kind === "variance" && x.propertyId === "P114")!.proposals.at(-1)!.disposition = "approved";
    expect(briefingInput(parsed, reviewed).fingerprint).not.toBe(input.fingerprint);
  });
  it("places every AI draft in exactly one outcome bucket", () => {
    const base = variance("P114"), proposal = base.proposals[0];
    const withDrafts = (status: CaseDetail["status"], dispositions: string[]): CaseDetail => ({ ...base, status, proposals: dispositions.map((disposition, i) => ({ ...proposal, id: `p${i}`, origin: "ai" as const, disposition })) });
    const usage = aiUsage([withDrafts("awaiting_evidence", ["returned", "pending"]), withDrafts("awaiting_evidence", ["approved"]), withDrafts("dismissed", ["pending"]), withDrafts("ready", ["pending", "pending"])]);
    expect(usage).toEqual({ generated: 6, approved: 1, returned: 1, pending: 2, superseded: 2 });
  });
});
