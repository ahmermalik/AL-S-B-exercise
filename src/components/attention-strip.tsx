"use client";
import { ArrowRight } from "lucide-react";
import type { Attention } from "@/shared/types";
import { money } from "@/lib/ui";
import { CountUp } from "./motion";

export type AttentionFilter = "followup" | "commentary" | "threshold";
export function AttentionStrip({ attention, active, onFilter, onAmounts }: { attention: Attention; active: string | null; onFilter: (filter: AttentionFilter) => void; onAmounts: () => void }) {
  const { followUp, commentary, amounts } = attention;
  const accepted = commentary.discrepancies.length - commentary.awaitingWording;
  return <section className="attention-strip" aria-label="Needs attention today">
    <div className="attention-item" data-tone="danger">
      <button type="button" className="attention-main" aria-pressed={active === "followup"} onClick={() => onFilter("followup")}>
        <strong><CountUp id="attention-followup" value={followUp.propertyIds.length} /></strong>
        <span className="attention-label">properties need close follow-up</span>
        <small className="attention-context">{followUp.overdue.length} with overdue steps · {followUp.commentary.length} with required commentary outstanding</small>
      </button>
    </div>
    <div className="attention-item" data-tone="warning">
      <button type="button" className="attention-main" aria-pressed={active === "commentary"} onClick={() => onFilter("commentary")}>
        <strong><CountUp id="attention-commentary" value={commentary.awaitingWording} /></strong>
        <span className="attention-label">commentary steps marked Complete without required explanations</span>
        <small className="attention-context">{accepted ? `${accepted} with wording accepted in review · tracker unchanged` : "Over the 10% policy threshold; no commentary in the workbook"}</small>
      </button>
      {commentary.thresholdReviews.length > 0 && <button type="button" className="attention-secondary" aria-pressed={active === "threshold"} onClick={() => onFilter("threshold")}>{commentary.thresholdReviews.length} due today need a threshold review, not commentary<ArrowRight size={13} aria-hidden="true" /></button>}
    </div>
    <div className="attention-item" data-tone="info">
      <button type="button" className="attention-main" aria-haspopup="dialog" onClick={onAmounts}>
        <strong><CountUp id="attention-amounts" value={amounts.reviews.length} /></strong>
        <span className="attention-label">invoices flagged for amount verification</span>
        <small className="attention-context">{money(amounts.totalCents)} · {amounts.pendingCount} pending approval</small>
      </button>
    </div>
  </section>;
}
