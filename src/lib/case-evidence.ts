import type { CaseDetail, Evidence } from "../shared/types";

/** Keep the selected recommendation's support separate from earlier submissions and execution attempts. */
export function caseEvidence(item: Pick<CaseDetail, "evidence" | "evidenceVersion" | "execution">, evidenceVersion = item.evidenceVersion) {
  const original = item.evidence.filter(record => record.kind === "workbook" || !!record.source);
  const support = item.evidence.filter(record => !original.includes(record) && record.kind !== "execution" && record.version === evidenceVersion);
  const latestExecution = item.execution?.evidenceVersion === evidenceVersion
    ? item.evidence.filter(record => record.kind === "execution" && record.version === evidenceVersion && record.label === item.execution?.reference).at(-1)
    : undefined;
  const execution = latestExecution ? [latestExecution] : [];
  const shown = new Set([...original, ...support, ...execution].map(record => record.id));
  const history = new Map<string, Evidence[]>();
  for (const record of item.evidence.filter(record => !shown.has(record.id)).reverse()) {
    const key = record.kind === "execution" ? record.id : `support-${record.version}`;
    history.set(key, [...(history.get(key) || []), record]);
  }
  return { original, support, execution, history: [...history.values()] };
}
