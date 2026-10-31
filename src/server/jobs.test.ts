import { describe, expect, it, vi } from "vitest";
import type { CaseDetail, Run } from "../shared/types";
import { processNextRun, type WorkerStore } from "./jobs";
import { AiUnavailableError, type AgentActivity, type ProposalInput, type reviseCaseWithAi } from "./llm";

const run: Run = { id: "run-1", importId: "import-1", status: "running", stage: "Queued", progress: 0, error: null, createdAt: "2026-10-31", updatedAt: "2026-10-31", completedCases: 0, totalCases: 0 };
const proposal: ProposalInput = { evidenceVersion: 0, route: "request_evidence", summary: "Posting support is missing.", rationale: "Review the source.", missing: ["Posting support"], sources: ["s1"], journal: [], origin: "ai" };
const caseDetail = (id: string, kind: CaseDetail["kind"] = "coding"): CaseDetail => ({ id, importId: run.importId, propertyId: "P105", propertyName: "Sunset Ridge", kind, title: "Invoice review", amountCents: 10000, status: "candidate", revision: 1, evidenceVersion: 0, nextAction: "Review", owner: "Accountant", facts: {}, evidence: [], proposals: [], requests: [], execution: null, history: [] });
function setup(cases = [caseDetail("c1")]) {
  let active = true;
  const activityRecords: AgentActivity[] = [];
  const store: WorkerStore = {
    claimRun: vi.fn(() => ({ ...run })), heartbeatRun: vi.fn(() => active),
    updateRun: vi.fn(() => active), prepareRunFindings: vi.fn(() => active), listRunCases: vi.fn(() => cases),
    getRunCaseStates: vi.fn(() => ({})), markRunCase: vi.fn(() => active),
    saveRunAgentProposal: vi.fn((_run, _worker, id) => cases.find(c => c.id === id)!),
    recordRunAgentActivity: vi.fn((_run, _worker, record) => { if (!active) return false; activityRecords.push(record); return true; }),
  };
  return { store, activityRecords, cancel: () => { active = false; }, reset: () => { active = false; activityRecords.length = 0; } };
}

describe("persistent preparation worker", () => {
  it("does not call an LLM when unconfigured and leaves deterministic findings usable", async () => {
    const { store } = setup(), revise = vi.fn();
    await processNextRun(store, "w1", { configured: () => false, revise });
    expect(store.prepareRunFindings).toHaveBeenCalledWith(run.id, "w1");
    expect(revise).not.toHaveBeenCalled();
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "partial", progress: 100 }));
  });

  it("uses AI only for coding and variance while rule-only cases keep their source-backed proposals", async () => {
    const cases = [caseDetail("duplicate", "duplicate"), caseDetail("approval", "approval"), caseDetail("close", "close"), caseDetail("coding", "coding"), caseDetail("variance", "variance")];
    const { store } = setup(cases);
    const revise = vi.fn<(detail: CaseDetail) => Promise<ProposalInput>>().mockResolvedValue(proposal);
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(revise.mock.calls.map(([detail]) => detail.id)).toEqual(["coding", "variance"]);
    expect(store.saveRunAgentProposal).toHaveBeenCalledTimes(2);
    expect(store.recordRunAgentActivity).toHaveBeenCalledWith(run.id, "w1", expect.objectContaining({ event: "rule_preparation_complete", caseId: "duplicate", importId: run.importId }));
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "complete", completedCases: 5 }));
  });

  it("counts rule-only completions accurately when semantic drafting is unavailable", async () => {
    const { store } = setup([caseDetail("d1", "duplicate"), caseDetail("a1", "approval"), caseDetail("coding", "coding")]);
    const revise = vi.fn();
    await processNextRun(store, "w1", { configured: () => false, revise });
    expect(revise).not.toHaveBeenCalled();
    expect(store.markRunCase).toHaveBeenCalledWith(run.id, "w1", "d1", "complete");
    expect(store.markRunCase).toHaveBeenCalledWith(run.id, "w1", "a1", "complete");
    expect(store.markRunCase).not.toHaveBeenCalledWith(run.id, "w1", "coding", "complete");
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "partial", completedCases: 2, error: expect.stringContaining("2 of 3") }));
  });

  it("completes a rule-only run without requiring provider configuration", async () => {
    const { store } = setup([caseDetail("d1", "duplicate"), caseDetail("a1", "approval"), caseDetail("s1", "close")]);
    const configured = vi.fn(() => false), revise = vi.fn();
    await processNextRun(store, "w1", { configured, revise });
    expect(configured).not.toHaveBeenCalled(); expect(revise).not.toHaveBeenCalled();
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "complete", completedCases: 3, error: null }));
  });

  it("resumes without regenerating completed cases", async () => {
    const { store } = setup([caseDetail("c1"), caseDetail("c2")]);
    vi.mocked(store.getRunCaseStates).mockReturnValue({ c1: { status: "complete", error: null } });
    const revise = vi.fn<(detail: CaseDetail) => Promise<ProposalInput>>().mockResolvedValue(proposal);
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(revise).toHaveBeenCalledTimes(1);
    expect(revise.mock.calls[0][0].id).toBe("c2");
    expect(store.saveRunAgentProposal).toHaveBeenCalledWith(run.id, "w1", "c2", 1, proposal);
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "complete", completedCases: 2 }));
  });

  it("preserves an approved case rather than replace its reviewed proposal", async () => {
    const c = caseDetail("c1"); c.status = "approved";
    const { store } = setup([c]), revise = vi.fn();
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(revise).not.toHaveBeenCalled();expect(store.saveRunAgentProposal).not.toHaveBeenCalled();
    expect(store.markRunCase).toHaveBeenCalledWith(run.id, "w1", c.id, "complete");
  });

  it("does not save a late model response after cancellation", async () => {
    const { store, cancel } = setup();
    await processNextRun(store, "w1", { configured: () => true, revise: vi.fn(async () => { cancel(); return proposal; }) });
    expect(store.saveRunAgentProposal).not.toHaveBeenCalled();
    expect(store.markRunCase).not.toHaveBeenCalled();
    expect(store.updateRun).not.toHaveBeenCalledWith(run.id, "w1", expect.objectContaining({ status: "complete" }));
  });

  it("discards late provider activity and the draft after a reset removes the run", async () => {
    const { store, activityRecords, reset } = setup();
    const revise = vi.fn<typeof reviseCaseWithAi>(async (_detail, options) => {
      options?.onActivity?.({ event: "evidence_tool", tool: "get_case_evidence" });
      reset();
      options?.onActivity?.({ event: "model_response", responseId: "late-response" });
      return proposal;
    });
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(activityRecords).toEqual([]);
    expect(store.saveRunAgentProposal).not.toHaveBeenCalled();
    expect(store.markRunCase).not.toHaveBeenCalled();
    expect(store.updateRun).not.toHaveBeenCalledWith(run.id, "w1", expect.objectContaining({ status: "complete" }));
    expect(store.updateRun).not.toHaveBeenCalledWith(run.id, "w1", expect.objectContaining({ status: "failed" }));
  });

  it("does not recreate failure audit records when a provider rejects after reset", async () => {
    const { store, activityRecords, reset } = setup();
    const revise = vi.fn<typeof reviseCaseWithAi>(async (_detail, options) => {
      reset();
      options?.onActivity?.({ event: "provider_error", status: 429, code: "credit_balance_exhausted" });
      throw new AiUnavailableError();
    });
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(activityRecords).toEqual([]);
    expect(store.markRunCase).not.toHaveBeenCalled();
    expect(store.saveRunAgentProposal).not.toHaveBeenCalled();
  });

  it("checks run ownership atomically before preparing findings", async () => {
    const { store, reset } = setup();
    vi.mocked(store.updateRun).mockImplementationOnce(() => { reset(); return true; });
    const revise = vi.fn();
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(store.prepareRunFindings).toHaveBeenCalledWith(run.id, "w1");
    expect(store.listRunCases).not.toHaveBeenCalled();
    expect(store.recordRunAgentActivity).not.toHaveBeenCalled();
    expect(revise).not.toHaveBeenCalled();
  });

  it("can claim a fresh queue after abandoning a reset run", async () => {
    const old = setup();
    await processNextRun(old.store, "w1", { configured: () => true, revise: vi.fn(async () => { old.reset(); return proposal; }) });
    const nextCase = caseDetail("new-case", "duplicate"); nextCase.importId = "new-import";
    const fresh = setup([nextCase]);
    vi.mocked(fresh.store.claimRun).mockReturnValue({ ...run, id: "new-run", importId: "new-import" });
    await processNextRun(fresh.store, "w1", { configured: () => false });
    expect(old.store.saveRunAgentProposal).not.toHaveBeenCalled();
    expect(fresh.store.prepareRunFindings).toHaveBeenCalledWith("new-run", "w1");
    expect(fresh.store.updateRun).toHaveBeenLastCalledWith("new-run", "w1", expect.objectContaining({ status: "complete", completedCases: 1 }));
    expect(fresh.activityRecords).toEqual([expect.objectContaining({ runId: "new-run", importId: "new-import", caseId: "new-case" })]);
  });

  it("records a stale-version drafting failure without losing other prepared cases", async () => {
    const { store } = setup([caseDetail("c1"), caseDetail("c2")]);
    vi.mocked(store.saveRunAgentProposal).mockImplementationOnce(() => { throw new Error("New evidence requires renewed review."); });
    await processNextRun(store, "w1", { configured: () => true, revise: vi.fn(async () => proposal) });
    expect(store.markRunCase).toHaveBeenCalledWith(run.id, "w1", "c1", "failed", "New evidence requires renewed review.");
    expect(store.markRunCase).toHaveBeenCalledWith(run.id, "w1", "c2", "complete");
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "partial", completedCases: 1 }));
  });

  it("stops a provider outage rather than repeat the same unavailable request for every case", async () => {
    const { store } = setup([caseDetail("c1"), caseDetail("c2")]);
    const revise = vi.fn().mockRejectedValue(new AiUnavailableError());
    await processNextRun(store, "w1", { configured: () => true, revise });
    expect(revise).toHaveBeenCalledTimes(1);
    expect(store.updateRun).toHaveBeenLastCalledWith(run.id, "w1", expect.objectContaining({ status: "partial", error: expect.stringContaining("0 of 2") }));
  });

  it("leaves an empty queue idle", async () => {
    const { store } = setup(); vi.mocked(store.claimRun).mockReturnValue(null);
    await expect(processNextRun(store, "w1")).resolves.toBe(false);
    expect(store.prepareRunFindings).not.toHaveBeenCalled();
  });
});
