import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { CaseDetail, Run } from "../shared/types";
import { findCases } from "./domain";
import { parseWorkbook, type ParsedWorkbook } from "./import";
import { preparationReceipt } from "./preparation-receipt";

let parsed: ParsedWorkbook, cases: CaseDetail[];
beforeAll(async () => {
  parsed = await parseWorkbook(readFileSync("seed/close-pack.xlsx"), "close-pack.xlsx");
  cases = findCases(parsed);
});
function run(patch: Partial<Run> = {}): Run {
  return { id: "run", importId: parsed.summary.id, status: "queued", stage: "Queued", progress: 0, error: null, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", completedCases: 0, totalCases: 0, stageLog: [], ...patch };
}

describe("preparation receipt from persisted current-workbook work", () => {
  it("does not turn an import or an unstarted/failed check into screening claims", () => {
    expect(preparationReceipt(null, cases, run())).toBeNull();
    expect(preparationReceipt(parsed.summary, [], null)).toBeNull();
    expect(preparationReceipt(parsed.summary, [], run())).toBeNull();
    expect(preparationReceipt(parsed.summary, [], run({ status: "failed", stage: "Preparation failed", stageLog: [{ name: "Checking", at: "2026-11-01T00:00:00Z" }] }))).toBeNull();
  });

  it("reports source screening separately from unavailable AI drafting in a partial run", () => {
    const receipt = preparationReceipt(parsed.summary, cases, run({ status: "partial", stage: "Review available", completedCases: 51, totalCases: 67 }));
    expect(receipt).toEqual({ importId: parsed.summary.id, screened: { invoices: 437, variances: 266, steps: 304 }, findings: 67, sourceRecordsAttached: 151, currentAiAnalyses: 0, approvalInvoices: 58, approvalProperties: 28 });
    // The same source row can support several findings; it remains one attached original row.
    const repeated = structuredClone(cases);
    repeated[0].evidence.push(...repeated[0].evidence);
    expect(preparationReceipt(parsed.summary, repeated, null)?.sourceRecordsAttached).toBe(151);
  });

  it("retains completed screening across retry and cancellation, including zero findings", () => {
    expect(preparationReceipt(parsed.summary, cases, run())?.findings).toBe(67);
    const cancelled = run({ status: "cancelled", stage: "Cancelled", stageLog: [{ name: "Investigating", at: "2026-11-01T00:00:00Z" }] });
    expect(preparationReceipt(parsed.summary, [], cancelled)).toMatchObject({ findings: 0, currentAiAnalyses: 0, screened: { invoices: 437 } });
    expect(preparationReceipt(parsed.summary, [], run({ status: "complete", stage: "Submitted" }))?.findings).toBe(0);
  });

  it("counts only current AI analyses whose cited evidence exists in the current case", () => {
    const reviewed = structuredClone(cases.slice(0, 4));
    for (const c of reviewed) c.proposals.at(-1)!.origin = "ai";
    reviewed[1].evidenceVersion++;
    reviewed[2].proposals.at(-1)!.sources = ["missing-evidence"];
    reviewed[3].proposals.at(-1)!.sources = [];
    expect(preparationReceipt(parsed.summary, reviewed, null)?.currentAiAnalyses).toBe(1);
    const c = reviewed[0];
    c.proposals.push({ ...c.proposals.at(-1)!, id: "manager-edit", origin: "manager" });
    expect(preparationReceipt(parsed.summary, reviewed, null)?.currentAiAnalyses).toBe(0);
  });

  it("does not attribute another import's cases or run to a newly selected workbook", () => {
    const changedSource = { ...parsed.summary, id: "different-import" };
    expect(preparationReceipt(changedSource, cases, run({ status: "complete", stage: "Submitted" }))).toBeNull();
  });
});
