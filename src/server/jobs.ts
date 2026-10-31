import type { CaseDetail, Proposal, Run } from "@/shared/types";
import { AiUnavailableError, isAiConfigured, reviseCaseWithAi, type AgentActivity } from "./llm";

export type RunPatch = Partial<Pick<Run, "stage" | "progress" | "status" | "error" | "completedCases" | "totalCases">>;
type ProposalInput = Omit<Proposal, "id" | "version" | "createdAt" | "disposition">;
export interface WorkerStore {
  claimRun(workerId: string): Run | null;
  heartbeatRun(id: string, workerId: string): boolean;
  updateRun(id: string, workerId: string, patch: RunPatch): boolean;
  prepareRunFindings(runId: string, workerId: string): boolean;
  listRunCases(importId: string): CaseDetail[];
  getRunCaseStates(runId: string): Record<string, { status: "complete" | "failed"; error: string | null }>;
  markRunCase(runId: string, workerId: string, caseId: string, status: "complete" | "failed", error?: string): boolean;
  saveRunAgentProposal(runId: string, workerId: string, caseId: string, expectedRevision: number, proposal: ProposalInput): CaseDetail;
  recordRunAgentActivity(runId: string, workerId: string, record: AgentActivity): boolean;
}
export interface WorkerOptions {
  configured?: () => boolean;
  revise?: typeof reviseCaseWithAi;
  signal?: AbortSignal;
  heartbeatMs?: number;
}

class LostJobError extends Error {}

export async function processNextRun(store: WorkerStore, workerId: string, options: WorkerOptions = {}): Promise<boolean> {
  const claimed = store.claimRun(workerId);
  if (!claimed) return false;
  const run = claimed;
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const heartbeat = setInterval(() => {
    try { if (!store.heartbeatRun(run.id, workerId)) controller.abort(new LostJobError("Run ownership changed.")); }
    catch { controller.abort(new LostJobError("Run heartbeat failed.")); }
  }, options.heartbeatMs || 10_000);
  heartbeat.unref?.();
  function update(patch: RunPatch) {
    signal.throwIfAborted();
    if (!store.updateRun(run.id, workerId, patch)) { controller.abort(); throw new LostJobError("Run is no longer active."); }
  }
  function activity(record: AgentActivity) {
    signal.throwIfAborted();
    if (!store.recordRunAgentActivity(run.id, workerId, { ...record, runId: run.id, importId: run.importId })) {
      controller.abort(new LostJobError("Run ownership changed before the activity record."));
      throw new LostJobError("Run is no longer active.");
    }
  }
  try {
    update({ stage: "Checking", status: "running", progress: 10, error: null });
    if (!store.prepareRunFindings(run.id, workerId)) throw new LostJobError("Run ownership changed before finding preparation.");
    const cases = store.listRunCases(run.importId);
    update({ stage: "Investigating", progress: 35, totalCases: cases.length });
    const states = store.getRunCaseStates(run.id);
    let completed = 0;
    let failures = 0;
    let providerUnavailable: string | null = null;
    const semanticCases: CaseDetail[] = [];
    for (const detail of cases) {
      signal.throwIfAborted();
      if (states[detail.id]?.status === "complete") { completed++; continue; }
      if (["approved", "executed", "verification_failed", "verified", "resolved", "dismissed"].includes(detail.status)) {
        if (!store.markRunCase(run.id, workerId, detail.id, "complete")) throw new LostJobError("Run ownership changed.");
        activity({ event: "review_preserved", caseId: detail.id, revision: detail.revision, at: new Date().toISOString() });
        completed++;
        continue;
      }
      if (!["coding", "variance"].includes(detail.kind)) {
        if (!store.markRunCase(run.id, workerId, detail.id, "complete")) throw new LostJobError("Run ownership changed.");
        activity({ event: "rule_preparation_complete", caseId: detail.id, kind: detail.kind, revision: detail.revision, evidenceVersion: detail.evidenceVersion, at: new Date().toISOString() });
        completed++;
        continue;
      }
      semanticCases.push(detail);
    }
    update({ stage: "Investigating", progress: 35, completedCases: completed });
    if (semanticCases.length && !(options.configured || isAiConfigured)()) {
      activity({ event: "preparation_partial", reason: "provider_not_configured", findings: cases.length, completedCases: completed, pendingSemanticDrafts: semanticCases.length, at: new Date().toISOString() });
      update({ stage: "Review available", status: "partial", progress: 100, error: `AI drafting is not configured. ${completed} of ${cases.length} cases are prepared; ${semanticCases.length} coding or variance draft${semanticCases.length === 1 ? " remains" : "s remain"}. All deterministic findings and manual review are available.`, completedCases: completed });
      return true;
    }
    for (let index = 0; index < semanticCases.length; index++) {
      signal.throwIfAborted();
      const detail = semanticCases[index];
      update({ stage: "Drafting", progress: 35 + Math.round(index / Math.max(1, semanticCases.length) * 55), completedCases: completed });
      try {
        const proposal = await (options.revise || reviseCaseWithAi)(detail, {
          signal,
          onActivity: record => activity({ ...record, caseId: detail.id }),
        });
        signal.throwIfAborted();
        if (!store.heartbeatRun(run.id, workerId)) throw new LostJobError("Run ownership changed before the draft commit.");
        store.saveRunAgentProposal(run.id, workerId, detail.id, detail.revision, proposal);
        if (!store.markRunCase(run.id, workerId, detail.id, "complete")) throw new LostJobError("Run ownership changed after the draft commit.");
        completed++;
      } catch (error) {
        if (signal.aborted || error instanceof LostJobError) throw error;
        failures++;
        const message = error instanceof Error ? error.message : "AI preparation failed.";
        if (!store.markRunCase(run.id, workerId, detail.id, "failed", message)) throw new LostJobError("Run ownership changed.");
        activity({ event: "case_drafting_failed", caseId: detail.id, error: message, at: new Date().toISOString() });
        if (error instanceof AiUnavailableError) { providerUnavailable = message; break; }
      }
    }
    update({ stage: "Validating", progress: 95, completedCases: completed });
    update({ stage: failures ? "Review available" : "Submitted", status: failures ? "partial" : "complete", progress: 100, completedCases: completed, error: providerUnavailable ? `${providerUnavailable} ${completed} of ${cases.length} cases prepared.` : failures ? `${failures} case draft${failures === 1 ? "" : "s"} could not be completed. Prepared findings remain available; retry failed drafting or review manually.` : null });
    return true;
  } catch (error) {
    if (!signal.aborted && !(error instanceof LostJobError)) store.updateRun(run.id, workerId, { status: "failed", stage: "Preparation failed", error: error instanceof Error ? error.message : "Preparation failed." });
    return true;
  } finally { clearInterval(heartbeat); }
}
