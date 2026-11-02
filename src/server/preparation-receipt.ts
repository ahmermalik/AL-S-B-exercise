import type { CaseDetail, ImportSummary, PreparationReceipt, Run } from "../shared/types";

const afterChecking = new Set(["Investigating", "Drafting", "Validating", "Submitted", "Review available"]);

/** A receipt describes persisted work for this workbook, including work retained when a run is retried. */
export function preparationReceipt(source: ImportSummary | null, cases: CaseDetail[], run: Run | null): PreparationReceipt | null {
  if (!source) return null;
  const current = cases.filter(c => c.importId === source.id);
  const matchingRun = run?.importId === source.id ? run : null;
  const checked = current.length > 0 || !!matchingRun && (
    matchingRun.status === "complete" || afterChecking.has(matchingRun.stage) ||
    !!matchingRun.stageLog?.some(stage => afterChecking.has(stage.name))
  );
  if (!checked) return null;

  const sourceRows = new Set<string>(), approvalRows = new Set<string>(), approvalProperties = new Set<string>();
  let currentAiAnalyses = 0;
  for (const c of current) {
    for (const evidence of c.evidence) if (evidence.source) sourceRows.add(`${evidence.source.sheet}:${evidence.source.row}`);
    const proposal = c.proposals.at(-1);
    if (proposal?.origin === "ai" && proposal.evidenceVersion === c.evidenceVersion && proposal.sources.length > 0 &&
      proposal.sources.every(id => c.evidence.some(e => e.id === id && (e.version === 0 || e.version === c.evidenceVersion)))) {
      currentAiAnalyses++;
    }
    if (c.kind === "approval") {
      approvalProperties.add(c.propertyId);
      // Count the original invoice records retained by these cases, not approval decisions or policy violations.
      for (const evidence of c.evidence) if (evidence.source?.sheet.startsWith("B2 ")) approvalRows.add(`${evidence.source.sheet}:${evidence.source.row}`);
    }
  }
  return {
    importId: source.id,
    screened: { invoices: source.counts.invoices, variances: source.counts.variances, steps: source.counts.steps },
    findings: current.length,
    sourceRecordsAttached: sourceRows.size,
    currentAiAnalyses,
    approvalInvoices: approvalRows.size,
    approvalProperties: approvalProperties.size,
  };
}
