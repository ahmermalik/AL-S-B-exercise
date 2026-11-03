"use client";
import { useState } from "react";
import { Link2, Search } from "lucide-react";
import type { CaseDetail, Evidence, SupportInput } from "@/shared/types";
import { duplicateReviewSummary } from "@/lib/duplicate-review-summary";
import { caseEvidence } from "@/lib/case-evidence";
import { dateTime, money } from "@/lib/ui";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { EvidenceRecord } from "./evidence-view";

function recordType(record: Evidence) {
  if (record.kind === "workbook") {
    if (record.data?.invoice) return "Invoice";
    if (record.data?.category) return "Budget and actual";
    if (record.data?.currentAccount) return "Chart of accounts";
    return "Close tracker";
  }
  return ({attestation:"Accountant explanation",invoice:"Invoice",ledger:"Ledger",payment:"Payment",policy:"Correction authority",approval:"Approval",close:"Close workpaper",execution:"Correction"} as Record<string,string>)[record.kind] || "Supporting record";
}

function recordAttribution(record: Evidence) {
  if (record.source) return `${record.source.sheet} · row ${record.source.row}`;
  const submitter = record.data?.recordedBy as {name?: unknown} | undefined;
  if (typeof submitter?.name === "string") return `Submitted by ${submitter.name}`;
  return `${record.kind === "execution" ? "Recorded by" : "Source author"}: ${record.author}`;
}

export function CaseEvidence({ item, evidenceVersion, cited, hoveredSource, onInspect }: {
  item: CaseDetail; evidenceVersion: number; cited: Set<string>; hoveredSource: string | null; onInspect: (record: Evidence) => void;
}) {
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const groups = caseEvidence(item, evidenceVersion);
  const duplicate = duplicateReviewSummary(item, evidenceVersion);
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
    const isSupport = title === "Accountant support" && !query.trim() && !duplicate;
    return visible.length ? <details className="evidence-group" aria-label={title} open={!!query.trim() || (title === "Original workbook" ? !groups.support.length && !groups.execution.length : title === "Accountant support" ? !groups.execution.length : true)}><summary>{title}<span className="small muted">{visible.length}</span></summary>{isSupport ? <><SupportOverview records={visible} latestSupport={evidenceVersion === item.evidenceVersion ? item.facts.support as SupportInput | undefined : undefined} /><details className="individual-evidence"><summary>Individual records ({visible.length})</summary>{rows(visible)}</details></> : rows(visible)}</details> : null;
  }
  const past = groups.history.map(filtered).filter(records => records.length);
  const currentGroups = [["Original workbook", groups.original], ["Accountant support", groups.support], ["Correction records", groups.execution]] as const;
  const recordBrowser = <>
<label className="search-field evidence-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Find supporting record" placeholder="Find invoice or record" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {evidenceVersion !== item.evidenceVersion && <p className="small section-gap">Showing support for the selected recommendation. Other submissions are below.</p>}
    {group("Original workbook", groups.original)}
    {group("Accountant support", groups.support)}
    {group("Correction records", groups.execution)}
    {past.length > 0 && <details className="evidence-history" open={query.trim() ? true : undefined}><summary>{evidenceVersion === item.evidenceVersion ? "Earlier submissions" : "Other submissions"} ({past.reduce((total, records) => total + records.length, 0)} records)</summary>{past.map(records => <details className="evidence-submission" key={records[0].id} open={query.trim() ? true : undefined}><summary>{records[0].kind === "execution" ? "Correction" : "Support"} · {dateTime(records[0].createdAt)} · {records.length} {records.length === 1 ? "record" : "records"}</summary>{rows(records)}</details>)}</details>}
    {!hasMatches && <p className="small muted section-gap">{item.evidence.length ? "No matching records. Try an invoice number, transaction or record type." : "No supporting records yet."}</p>}
  </>;
  return <>
    {duplicate && <section className="duplicate-review-summary" aria-label="Duplicate conclusion and correction">
      <h3>What happened</h3><strong>{duplicate.finding.title}</strong><p>{duplicate.finding.detail}</p>
      <h3>What changed</h3><strong>{duplicate.correction.title}</strong><p>{duplicate.correction.detail}</p>
      {duplicate.reference && <p className="small muted">Correction reference: {duplicate.reference}</p>}
      {duplicate.recordedResult && <p className="small muted">This result is based on records submitted in the app. The app does not post corrections or check a live ledger.</p>}
    </section>}
    <div className="evidence-review-action"><Button variant="outline" disabled={!currentGroups.some(([, records]) => records.length)} onClick={() => setReviewing(true)}>Review all records</Button></div>
    {duplicate ? <details className="supporting-document-list" open={!item.facts.support && !item.execution}><summary>Supporting documents</summary>{recordBrowser}</details> : recordBrowser}
    <Dialog open={reviewing} onOpenChange={setReviewing} title="Review supporting records" description={`${item.propertyName} · Records for the selected recommendation. Earlier submissions remain in the history.`} wide>
      {currentGroups.map(([title, records]) => records.length > 0 && <section className="combined-evidence-group" key={title} aria-label={title}><h3>{title}</h3>{records.map(record => <article className="combined-evidence-record" key={record.id}><div className="evidence-record-heading"><span className="source-ref">{recordType(record)}</span>{cited.has(record.id) && <span className="cited-tag">Used</span>}</div><h4>{record.label}</h4><p className="small muted">{recordAttribution(record)} · <time dateTime={record.createdAt}>{dateTime(record.createdAt)}</time></p><EvidenceRecord evidence={record} /></article>)}</section>)}
    </Dialog>

  </>;
}

function SupportOverview({ records, latestSupport }: { records: Evidence[]; latestSupport?: SupportInput }) {
  const explanation = records.find(record => record.kind === "attestation");
  const invoice = records.find(record => record.kind === "invoice")?.data;
  const posting = ({posted:"Posted",unposted:"Not posted",unknown:"Not established"} as Record<string,string>)[String(invoice?.postingState)] || "Not established";
  const payment = ({unpaid:"Unpaid · not scheduled",scheduled:"Scheduled",paid:"Paid",unknown:"Not established"} as Record<string,string>)[String(invoice?.paymentState)] || "Not established";
  return <div className="support-overview">
    {explanation && <p className="pre-wrap small">{explanation.text.length > 240 ? `${explanation.text.slice(0,240)}…` : explanation.text}</p>}
    {invoice && <><p className="source-ref">As reported in the submitted support</p><dl className="key-value"><dt>Invoice</dt><dd>{String(invoice.invoiceReference || "Not recorded")}</dd><dt>Bill under review</dt><dd>{String(invoice.transactionId || "Not recorded")}</dd>{latestSupport?.retainedTransactionId && <><dt>Bill to retain</dt><dd>{latestSupport.retainedTransactionId}</dd></>}<dt>Posting</dt><dd>{posting}</dd><dt>Payment</dt><dd>{payment}</dd></dl></>}
    {!invoice && !explanation && <p className="small muted">{records.length} supporting {records.length === 1 ? "record" : "records"} submitted for review.</p>}
  </div>;
}
