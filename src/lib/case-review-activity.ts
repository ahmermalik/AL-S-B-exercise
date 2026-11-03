import type { CaseDetail } from "../shared/types";

/** Use the recorded submitter, not the source document's author. Keep approval tied to the latest proposal. */
export function caseReviewActivity(item: Pick<CaseDetail, "evidence" | "evidenceVersion" | "proposals" | "history">) {
  const supportEvent = [...item.history].reverse().find(event => event.action.includes(` as E${item.evidenceVersion} and prepared proposal `) && event.action.startsWith("Recorded support from "));
  const record = [...item.evidence].reverse().find(evidence => evidence.version === item.evidenceVersion && evidence.kind !== "execution" && evidence.data?.recordedBy);
  const recordedBy = record?.data?.recordedBy as { name?: unknown } | undefined;
  const support = record && typeof recordedBy?.name === "string"
    ? { name: recordedBy.name, at: supportEvent?.at || record.createdAt }
    : supportEvent ? { name: supportEvent.actor, at: supportEvent.at } : null;
  const latest = item.proposals.at(-1);
  const approvalEvent = latest?.disposition === "approved" && latest.evidenceVersion === item.evidenceVersion
    ? [...item.history].reverse().find(event => event.action.startsWith(`Approved proposal v${latest.version} / E${latest.evidenceVersion};`) || event.action.startsWith(`Approved proposal v${latest.version} / E${latest.evidenceVersion} wording;`))
    : undefined;
  return { support, approval: approvalEvent ? { name: approvalEvent.actor, at: approvalEvent.at } : null };
}
