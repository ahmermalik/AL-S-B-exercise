import type { CaseDetail, SupportInput } from "../shared/types";
import { money } from "./ui";

/** Describe the recorded accounting result without treating support, approval or sample execution as live posting. */
export function duplicateReviewSummary(item: CaseDetail, evidenceVersion = item.evidenceVersion) {
  if (item.kind !== "duplicate" || evidenceVersion !== item.evidenceVersion) return null;
  const support = item.facts.support as SupportInput | undefined;
  const latest = item.proposals.at(-1);
  const target = support?.transactionId, retained = support?.retainedTransactionId;
  const confirmed = support?.duplicateConfirmed && latest?.evidenceVersion === item.evidenceVersion && !latest.missing.length && ["AP reversal", "Invoice rejection"].includes(latest.route);
  const finding = support?.duplicateAssessment === "not_duplicate" ? {title:"Accountant reports separate invoices",detail:support.explanation}
    : confirmed
    ? { title: "Accountant confirmed a duplicate", detail: `Invoice ${support.invoiceReference} was entered twice: ${retained} is the valid bill; ${target} is the extra entry. The submitted support shows both bills were unpaid and not scheduled for payment.` }
    : support?.duplicateConfirmed
      ? { title: "Duplicate reported; review incomplete", detail: "The accountant reports that one invoice was entered twice. Required checks or supporting records are still missing." }
      : { title: "Possible duplicate; not confirmed", detail: "Two workbook entries look alike. The invoice and accounting records are still needed to establish whether they are the same bill." };
  if (item.status === "dismissed") {
    const reason = [...item.history].reverse().find(event => event.action.startsWith("Dismissed with reason: "))?.action.slice("Dismissed with reason: ".length);
    return { finding, correction: {title:"Closed without a correction",detail:reason || "The manager dismissed this finding. Dismissal does not establish that a duplicate was corrected."}, reference:null, recordedResult:false };
  }
  if (support?.duplicateAssessment === "not_duplicate") return {finding,correction:{title:"No correction proposed",detail:latest?.missing.length ? "More records are needed to support this conclusion. The manager can request evidence or changes." : "The manager needs to review the response and confirm whether no correction is needed."},reference:null,recordedResult:false};
  const execution = item.execution;
  const currentExecution = !!execution && execution.evidenceVersion === item.evidenceVersion && execution.proposalId === latest?.id;
  const checked = currentExecution && execution.verified && ["verified", "resolved"].includes(item.status);
  if (checked && confirmed) {
    return { finding, correction: {
      title: item.status === "resolved" ? latest.route === "AP reversal" ? "Extra bill reversed; review closed" : "Extra bill rejected; review closed" : "Correction checked; manager confirmation needed",
      detail: latest.route === "AP reversal"
        ? `Duplicate bill ${target} was reversed for ${money(item.amountCents)}. Valid unpaid bill ${retained} remains. The checked records show no cash change.`
        : `Extra unposted bill ${target} was rejected. Valid bill ${retained} remains. No standalone journal entry or cash change was needed.`,
    }, reference:execution.reference, recordedResult:true };
  }
  if (item.status === "verification_failed") return {finding,correction:{title:"Correction did not pass the checks",detail:"The recorded result does not match the approved correction. This issue remains open; correct the execution details and check again."},reference:currentExecution ? execution.reference : null,recordedResult:true};
  if (item.status === "executed" && currentExecution) return {finding,correction:{title:"Correction recorded; not yet checked",detail:`A correction for bill ${target} was recorded. Check the refreshed records before treating this issue as fixed.`},reference:execution.reference,recordedResult:true};
  const action = confirmed ? latest.route === "AP reversal" ? `Reverse extra bill ${target} for ${money(item.amountCents)} and keep ${retained}.` : `Reject extra unposted bill ${target} and keep ${retained}.` : "Provide the missing support before deciding whether to correct either entry.";
  return {finding,correction:{title:item.status === "approved" ? "Approved; correction not yet recorded" : "No correction recorded",detail:action},reference:null,recordedResult:false};
}
