"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AmountReview, Attention, Evidence } from "@/shared/types";
import { money } from "@/lib/ui";
import { Button } from "./ui/button";
import { Status } from "./common";
import { EvidenceRecord } from "./evidence-view";

function sourceRecord(review: AmountReview): Evidence {
  const { invoice, vendor, propertyName, propertyId, gl, description, amountCents, invoiceDate, receivedDate, approval, codedBy } = review;
  return { id: `amount-${review.source.row}`, label: invoice, kind: "workbook", author: "Original workbook", text: "", version: 0, createdAt: "", source: review.source,
    data: { invoice, vendor, propertyName, propertyId, gl, description, amountCents, invoiceDate, receivedDate, approval, codedBy } };
}
export function AmountReviewList({ amounts }: { amounts: Attention["amounts"] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!amounts.reviews.length) return <p className="muted">No invoice is unusually high compared with others that share its description.</p>;
  return <div className="stack">
    <p className="small muted">Each invoice is compared with the other invoices that share its description. Verifying an amount needs the vendor invoice, so verification stays outstanding here. Regional Manager approval evidence is a separate review.</p>
    <ul className="amount-list">{amounts.reviews.map(review => {
      const row = review.source.row, expanded = open === row;
      return <li key={row} className="amount-item">
        <div className="amount-head">
          <div className="grow"><h3>{review.invoice} · {review.vendor}</h3><p className="small muted">{review.propertyName} · {review.description} · {review.approval === "Pending" ? "Pending approval" : `Source status ${review.approval}`}</p></div>
          <strong className="mono amount-value">{money(review.amountCents)}</strong>
        </div>
        <p className="small">{review.multiple}× the median of {review.peerCount} other “{review.description}” invoices ({money(review.peerMedianCents)}; range {money(review.peerLowCents)}–{money(review.peerHighCents)}).</p>
        <div className="amount-foot">
          <Status value="awaiting_evidence" label="Amount verification outstanding" />
          <span className="small muted">Owner · {review.owner}</span>
          <span className="grow" />
          <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row)}>{expanded ? "Hide source" : "Inspect source"}</Button>
          {review.approvalCaseId && <Button variant="ghost" size="sm" asChild><Link href={`/cases/${review.approvalCaseId}`}>Approval evidence case<ArrowRight size={14} /></Link></Button>}
        </div>
        {expanded && <div className="amount-source"><div className="evidence-meta"><span className="source-tag">Original workbook</span><span className="mono">{review.source.sheet} · row {row}</span></div><EvidenceRecord evidence={sourceRecord(review)} /></div>}
      </li>;
    })}</ul>
    <p className="small muted">Selection: robust z-score above {amounts.robustDeviations}, using the median and median absolute deviation of at least {amounts.minPeers} comparable invoices.</p>
  </div>;
}
