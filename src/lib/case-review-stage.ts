import type { CaseDetail } from "../shared/types";
export type CaseReviewStage = "needs_support" | "changes_requested" | "update_recommendation" | "review" | "approved" | "execution_check" | "resolve" | "closed";
/** Choose the work available now. Accepting variance wording is separate from resolving its missing support. */
export function caseReviewStage(item: Pick<CaseDetail, "status" | "kind" | "evidenceVersion" | "proposals">): CaseReviewStage {
  if (item.status === "resolved" || item.status === "dismissed") return "closed";
  if (item.status === "approved") return "approved";
  if (item.status === "executed" || item.status === "verification_failed") return "execution_check";
  if (item.status === "verified") return "resolve";
  const latest = item.proposals.at(-1);
  if (!latest || latest.evidenceVersion !== item.evidenceVersion) return "update_recommendation";
  if (latest.disposition === "returned") return "changes_requested";
  if (latest.disposition === "approved") return latest.missing.length ? "needs_support" : "update_recommendation";
  return latest.missing.length && item.kind !== "variance" ? "needs_support" : "review";
}
