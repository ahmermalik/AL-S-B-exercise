"use client";
import { useState } from "react";
import { Link2, Search } from "lucide-react";
import type { CaseDetail, Evidence } from "@/shared/types";
import { caseEvidence } from "@/lib/case-evidence";
import { dateTime, money } from "@/lib/ui";
import { Button } from "./ui/button";

function recordType(record: Evidence) {
  if (record.kind === "workbook") {
    if (record.data?.invoice) return "Invoice";
    if (record.data?.category) return "Budget and actual";
    if (record.data?.currentAccount) return "Chart of accounts";
    return "Close tracker";
  }
  return ({attestation:"Accountant explanation",invoice:"Invoice",ledger:"Ledger",payment:"Payment",policy:"Correction authority",approval:"Approval",close:"Close workpaper",execution:"Correction"} as Record<string,string>)[record.kind] || "Supporting record";
}

export function CaseEvidence({ item, evidenceVersion, cited, hoveredSource, onInspect }: {
  item: CaseDetail; evidenceVersion: number; cited: Set<string>; hoveredSource: string | null; onInspect: (record: Evidence) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = caseEvidence(item, evidenceVersion);
  const matches = (record: Evidence) => `${recordType(record)} ${record.label} ${record.author} ${record.text} ${String((record.data?.recordedBy as { name?: string } | undefined)?.name || "")}`.toLowerCase().includes(query.trim().toLowerCase());
  const filtered = (records: Evidence[]) => records.filter(matches);
  const hasMatches = item.evidence.some(matches);
  function rows(records: Evidence[]) {
    return records.map(record => {
      const submitter = record.data?.recordedBy as {name?: string} | undefined;
      return <div id={`ev-${record.id}`} key={record.id} className="evidence-record-row" data-highlight={hoveredSource === record.id || undefined}>
        <div className="evidence-record-heading"><span className="source-ref">{recordType(record)}</span>{cited.has(record.id) && <span className="cited-tag" title="Used in the selected recommendation"><Link2 size={11} />Used</span>}</div>
        <h4>{record.label}</h4>
        {record.source ? <p className="small muted">{typeof record.data?.amountCents === "number" ? `${money(record.data.amountCents)} · ` : ""}{record.data?.gl ? `GL ${record.data.gl} · ` : ""}{record.data?.invoiceDate ? String(record.data.invoiceDate) : "Original workbook record"}</p> : <p className="small muted">{submitter?.name || record.author} · <time dateTime={record.createdAt}>{dateTime(record.createdAt)}</time></p>}
        <Button variant="ghost" size="sm" className="inline-action" onClick={() => onInspect(record)}>Inspect record</Button>
      </div>;
    });
  }
  function group(title: string, records: Evidence[]) {
    const visible = filtered(records);
    return visible.length ? <details className="evidence-group" aria-label={title} open={!!query.trim() || (title === "Original workbook" ? !groups.support.length && !groups.execution.length : title === "Accountant support" ? !groups.execution.length : true)}><summary>{title}<span className="small muted">{visible.length}</span></summary>{rows(visible)}</details> : null;
  }
  const past = groups.history.map(filtered).filter(records => records.length);
  return <>
    <label className="search-field evidence-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Find supporting record" placeholder="Find invoice or record" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {evidenceVersion !== item.evidenceVersion && <p className="small section-gap">Showing support for the selected recommendation. Other submissions are below.</p>}
    {group("Original workbook", groups.original)}
    {group("Accountant support", groups.support)}
    {group("Correction records", groups.execution)}
    {past.length > 0 && <details className="evidence-history" open={query.trim() ? true : undefined}><summary>{evidenceVersion === item.evidenceVersion ? "Earlier submissions" : "Other submissions"} ({past.reduce((total, records) => total + records.length, 0)} records)</summary>{past.map(records => <details className="evidence-submission" key={records[0].id} open={query.trim() ? true : undefined}><summary>{records[0].kind === "execution" ? "Correction" : "Support"} · {dateTime(records[0].createdAt)} · {records.length} {records.length === 1 ? "record" : "records"}</summary>{rows(records)}</details>)}</details>}
    {!hasMatches && <p className="small muted section-gap">{item.evidence.length ? "No matching records. Try an invoice number, transaction or record type." : "No supporting records yet."}</p>}
  </>;
}
