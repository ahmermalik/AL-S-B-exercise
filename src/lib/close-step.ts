import type { CloseStep } from "@/shared/types";

export function describeCloseStep(step: CloseStep, asOfBD: number) {
  const daysOverdue = Math.max(0, asOfBD - step.dueBD);
  if (step.conflict || (step.completedBD !== null && step.completedBD > asOfBD)) {
    return { state: "conflict", label: "Date conflict", daysOverdue: 0,
      description: `The tracker records completion on business day ${step.completedBD ?? "unknown"}, after the business day ${asOfBD} snapshot. Confirm the date before accepting completion.` } as const;
  }
  if (step.status.toLowerCase() === "complete") {
    return { state: "complete", label: "Reported complete", daysOverdue: 0,
      description: step.completedBD === null ? "The tracker reports Complete but supplies no completion day. The supporting workpaper remains a separate review." : `The tracker reports completion on business day ${step.completedBD}. The supporting workpaper remains a separate review.` } as const;
  }
  if (daysOverdue > 0 || step.status.toLowerCase() === "late") {
    return { state: "late", label: daysOverdue > 0 ? `${daysOverdue} business ${daysOverdue === 1 ? "day" : "days"} overdue` : "Reported overdue", daysOverdue,
      description: daysOverdue > 0 ? `Due business day ${step.dueBD}; completion is not reported at business day ${asOfBD}.` : `The tracker says Late, but the due day has not passed at the business day ${asOfBD} snapshot. Confirm the deadline and tracker status.` } as const;
  }
  if (step.dueBD === asOfBD) {
    return { state: "due", label: "Due today", daysOverdue: 0,
      description: `Due on business day ${step.dueBD}, the current close snapshot. Completion has not been reported.` } as const;
  }
  return { state: "upcoming", label: "Not due yet", daysOverdue: 0,
    description: `Scheduled for business day ${step.dueBD}; the close snapshot is business day ${asOfBD}.` } as const;
}
