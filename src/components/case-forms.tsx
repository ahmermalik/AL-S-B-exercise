"use client";
import { useState, type FormEvent } from "react";
import { Download, LoaderCircle } from "lucide-react";
import type { CaseDetail, SupportInput } from "@/shared/types";
import { api } from "@/lib/api";
import { money } from "@/lib/ui";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Notice } from "./common";
type Action = (input: Record<string, unknown>) => Promise<boolean>;
export function TextActionForm({ action, label, initial, onSubmit, busy }: { action: string; label: string; initial: string; onSubmit: Action; busy: boolean }) {
  const [text, setText] = useState(initial);
  return <form className="form-stack" onSubmit={async e => { e.preventDefault(); await onSubmit({ action, [action === "request" ? "text" : action === "edit" ? "summary" : "reason"]: text }); }}>{action === "edit" && <p className="small muted">Edit the explanation. Saving creates a new version for review; it does not change the invoice records or approve a correction.</p>}<label>{action === "request" ? "Information needed" : action === "edit" ? "Explanation" : action === "return" ? "Changes needed" : "Reason"}<textarea required disabled={busy} minLength={5} maxLength={4000} value={text} onChange={e => setText(e.target.value)} /></label><div className="actions"><Button type="submit" disabled={busy}>{busy && <LoaderCircle size={15} className="spin" />}{label}</Button></div></form>;
}
const blankSupport = (author: string): SupportInput => ({ author, period: "September 2026", explanation: "", invoiceReference: "", transactionId: "", retainedTransactionId: "", entity: "", postingState: "unknown", paymentState: "unknown", duplicateConfirmed: false, periodOpen: false, correctionAuthorized: false, invoiceRecord: "", ledgerRecord: "", paymentRecord: "", policyRecord: "" });
export function SupportForm({ item, author, busy, onSubmit }: { item: CaseDetail; author: string; busy: boolean; onSubmit: Action }) {
  const existing = item.facts.support as SupportInput | undefined;
  const [support, setSupport] = useState<SupportInput>(() => existing ? structuredClone(existing) : blankSupport(author));
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [sampleLoaded, setSampleLoaded] = useState(false);
  const financial = item.kind === "duplicate" || item.kind === "coding";
  const assessment = support.duplicateAssessment || (support.duplicateConfirmed ? "duplicate" : "uncertain");
  const changesRequested = item.proposals.at(-1)?.disposition === "returned";
  const invoices = (Array.isArray(item.facts.invoices) ? item.facts.invoices : []) as { invoice: string; vendor: string; source: { row: number } }[];
  const steps = [...new Set([...(Array.isArray(item.facts.lateSteps) ? item.facts.lateSteps : []), ...(Array.isArray(item.facts.conflictingSteps) ? item.facts.conflictingSteps : [])].map(step => String(step.name)))];
  const [approvalRecords, setApprovalRecords] = useState<NonNullable<SupportInput["approvalRecords"]>>(() => existing?.approvalRecords ? structuredClone(existing.approvalRecords) : invoices.map(invoice => ({invoiceRow:invoice.source.row,approverRole:"",reference:"",approvedBeforePayment:false})));
  const [closeRecords, setCloseRecords] = useState<NonNullable<SupportInput["closeRecords"]>>(() => existing?.closeRecords ? structuredClone(existing.closeRecords) : steps.map(step => ({step,completedBD:0,reference:""})));
  function update<K extends keyof SupportInput>(key: K, value: SupportInput[K]) { setSupport(previous => ({...previous,[key]:value})); }
  function chooseAssessment(value: string) {
    const next = value as NonNullable<SupportInput["duplicateAssessment"]>;
    setSupport(previous => ({...previous,duplicateAssessment:next,duplicateConfirmed:next === "duplicate",...(sampleLoaded && next !== "duplicate" ? {invoiceRecord:"",ledgerRecord:"",paymentRecord:"",policyRecord:"",periodOpen:false,correctionAuthorized:false} : {})}));
    if (sampleLoaded && next !== "duplicate") { setSampleLoaded(false); setError("The duplicate sample was cleared. Add records for your new conclusion in Source details, or submit what you know and leave the evidence request open."); }
  }
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<SupportInput | null>(`/api/cases/${item.id}/support-template`);
      if (!result) throw new Error("No sample evidence is available for this finding.");
      setSupport({...result,author,...(item.kind === "duplicate" ? {duplicateAssessment:"duplicate" as const} : {})}); setSampleLoaded(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Sample evidence could not be loaded. Try again."); }
    finally { setLoading(false); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    await onSubmit({action:"support",support:{...support,...(item.kind === "duplicate" ? {duplicateAssessment:assessment,duplicateConfirmed:assessment === "duplicate"} : {}),...(item.kind === "approval" ? {approvalRecords} : {}),...(item.kind === "close" && steps.length ? {closeRecords} : {})}});
  }
  return <form className="form-stack" onSubmit={submit}><fieldset disabled={loading || busy} className="form-stack">
    <div className="inline"><h3 className="grow">Your response</h3>{financial && !existing && item.propertyId === "P105" && <Button variant="outline" size="sm" onClick={load} disabled={loading || busy}>{loading ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}Load sample evidence</Button>}</div>
    <p className="small muted">Submitting as {author} · {support.period}</p>
    {error && <Notice>{error}</Notice>}
    {changesRequested && <Notice tone="warning"><strong>Manager requested changes</strong><p className="small section-gap">{item.nextAction}</p></Notice>}
    {sampleLoaded && <div className="sample-receipt" role="status"><strong>Sample loaded — not submitted</strong><p>{item.kind === "duplicate" ? `Invoice ${support.invoiceReference} was entered twice. ${support.transactionId} is the extra bill; keep ${support.retainedTransactionId}.` : `Invoice ${support.invoiceReference} needs an account correction.`}</p><p>{support.postingState === "posted" ? "Posted" : "Not posted"} · {support.paymentState === "unpaid" ? "Unpaid and not scheduled" : support.paymentState}. Sample invoice, accounting records and correction permission are included.</p></div>}
    {item.kind === "duplicate" && <label className="form-field">What did you find?<Select aria-label="What did you find?" value={assessment} onValueChange={chooseAssessment} options={[{value:"uncertain",label:"I need more evidence"},{value:"duplicate",label:"This is a duplicate"},{value:"not_duplicate",label:"These are separate invoices"}]} /></label>}
    <label className="form-field">Your explanation<textarea required minLength={5} maxLength={4000} value={support.explanation} onChange={e => update("explanation",e.target.value)} placeholder="What did you find, and what should happen next?" /></label>
    {item.kind === "approval" && approvalRecords.map((record,index) => <fieldset className="divider" key={record.invoiceRow}><legend>{invoices[index] ? `${invoices[index].invoice} · ${invoices[index].vendor}` : `Invoice ${index+1}`}</legend><div className="form-grid"><label className="form-field">Approver role<input required value={record.approverRole} onChange={e => setApprovalRecords(previous => previous.map((r,i) => i === index ? {...r,approverRole:e.target.value} : r))} /></label><label className="form-field">Approval reference<input required value={record.reference} onChange={e => setApprovalRecords(previous => previous.map((r,i) => i === index ? {...r,reference:e.target.value} : r))} /></label></div><label className="check-row section-gap"><input type="checkbox" checked={record.approvedBeforePayment} onChange={e => setApprovalRecords(previous => previous.map((r,i) => i === index ? {...r,approvedBeforePayment:e.target.checked} : r))} />Source evidence establishes approval before payment.</label></fieldset>)}
    {item.kind === "close" && closeRecords.map((record,index) => <fieldset className="divider" key={record.step}><legend>{record.step}</legend><div className="form-grid"><label className="form-field">Completed business day<input required type="number" min={1} max={31} value={record.completedBD || ""} onChange={e => setCloseRecords(previous => previous.map((r,i) => i === index ? {...r,completedBD:Number(e.target.value)} : r))} /></label><label className="form-field">Supporting work reference<input required value={record.reference} onChange={e => setCloseRecords(previous => previous.map((r,i) => i === index ? {...r,reference:e.target.value} : r))} /></label></div></fieldset>)}
    <details className="source-detail-fields"><summary>Source details</summary><div className="form-grid section-gap">
      <label className="form-field">Source author<input value={support.author} onChange={e => update("author",e.target.value)} /></label><label className="form-field">Accounting period<input value={support.period} onChange={e => update("period",e.target.value)} /></label>
      {financial && <><label className="form-field">Source invoice reference<input value={support.invoiceReference || ""} onChange={e => update("invoiceReference",e.target.value)} /></label><label className="form-field">Source transaction ID<input value={support.transactionId} onChange={e => update("transactionId",e.target.value)} /></label>{item.kind === "duplicate" && <label className="form-field">Retained transaction ID<input value={support.retainedTransactionId || ""} onChange={e => update("retainedTransactionId",e.target.value)} /></label>}<label className="form-field">Property / legal entity<input value={support.entity} onChange={e => update("entity",e.target.value)} /></label><label className="form-field">Posting state<Select value={support.postingState} onValueChange={v => update("postingState",v as SupportInput["postingState"])} options={[{value:"unknown",label:"Not established"},{value:"unposted",label:"Unposted"},{value:"posted",label:"Posted"}]} /></label><label className="form-field">Payment state<Select value={support.paymentState} onValueChange={v => update("paymentState",v as SupportInput["paymentState"])} options={[{value:"unknown",label:"Not established"},{value:"unpaid",label:"Unpaid · not scheduled"},{value:"scheduled",label:"Scheduled"},{value:"paid",label:"Paid"}]} /></label><label className="form-field full-width">Invoice record<textarea value={support.invoiceRecord} onChange={e => update("invoiceRecord",e.target.value)} /></label></>}
      {(financial || item.kind === "variance") && <label className="form-field full-width">Ledger / source record<textarea value={support.ledgerRecord} onChange={e => update("ledgerRecord",e.target.value)} /></label>}
      {financial && <><label className="form-field full-width">Payment / queue record<textarea value={support.paymentRecord} onChange={e => update("paymentRecord",e.target.value)} /></label><label className="form-field full-width">Correction policy / authority<textarea value={support.policyRecord} onChange={e => update("policyRecord",e.target.value)} /></label></>}
    </div>{financial && <><label className="check-row"><input type="checkbox" checked={support.periodOpen} onChange={e => update("periodOpen",e.target.checked)} />The correction period is open.</label><label className="check-row"><input type="checkbox" checked={support.correctionAuthorized} onChange={e => update("correctionAuthorized",e.target.checked)} />The supplied policy permits this correction route.</label></>}</details>
    <div className="actions"><Button type="submit" disabled={busy || loading}>{busy && <LoaderCircle className="spin" size={15} />}{existing ? "Submit updated response" : "Submit response"}</Button></div>
  </fieldset></form>;
}
export function ExecutionForm({ item, busy, onSubmit }: { item: CaseDetail; busy: boolean; onSubmit: Action }) {
  const template = item.facts.executionTemplate && typeof item.facts.executionTemplate === "object" ? item.facts.executionTemplate as Record<string,unknown> : {};
  const [reference,setReference] = useState(""); const [target,setTarget] = useState(String(template.targetId || "")); const [amount,setAmount] = useState((item.amountCents/100).toFixed(2)); const [notes,setNotes] = useState("");
  const [observed,setObserved] = useState<Record<string,string|boolean>>({}); const [loaded,setLoaded] = useState(false); const [error,setError] = useState("");
  const route = item.proposals.at(-1)?.route;
  const sampleAvailable = item.propertyId === "P105" && ["StaffBridge","Office Depot","Lone Star Lawn"].some(vendor => item.title.includes(vendor)) && typeof template.targetId === "string";
  const approvedChange = route === "AP reversal"
    ? `Reverse extra bill ${template.targetId} for ${money(item.amountCents)}. Keep valid bill ${template.retainedId}.`
    : route === "Invoice rejection"
      ? `Reject extra unposted bill ${template.targetId}. Keep valid bill ${template.retainedId}.`
      : route === "Expense reclassification"
        ? `Move ${money(item.amountCents)} from account ${template.creditAccount} to ${template.debitAccount}.`
        : item.proposals.at(-1)?.summary;
  const labels: Record<string,string> = {recordSource:"Source record reference",targetId:"Source transaction",amountCents:"Source correction amount",cashChangeCents:"Cash change",apChangeCents:"AP change",expenseChangeCents:"Expense change",reversedBalanceCents:"Reversed bill balance",retainedId:"Retained invoice ID",retainedBalanceCents:"Retained invoice balance",debitAccount:"Debit account",creditAccount:"Credit account",debitCents:"Debit amount",creditCents:"Credit amount",sourceState:"Source status",targetAccount:"Corrected account"};
  const keys = Array.from(new Set(["recordSource",...Object.keys(template)])).filter(key => typeof template[key] !== "object" && !/fixture|provenance|simulat/i.test(key));
  function load() {
    setError(""); setReference(`SAMPLE-${template.targetId}-CORRECTION`);setTarget(String(template.targetId));setAmount((item.amountCents/100).toFixed(2));
    setObserved(Object.fromEntries(keys.map(key => [key,key === "recordSource" ? `SAMPLE-${template.targetId}-AFTER` : typeof template[key] === "number" ? (template[key]/100).toFixed(2) : typeof template[key] === "boolean" ? template[key] : String(template[key] ?? "")])));
    setNotes(route === "AP reversal" ? `Sample: reversed extra bill ${template.targetId} for ${money(item.amountCents)}. Valid unpaid bill ${template.retainedId} remains. Cash did not change.` : route === "Invoice rejection" ? `Sample: rejected extra unposted bill ${template.targetId}. Valid bill ${template.retainedId} remains. No cash changed.` : `Sample: reclassified ${money(item.amountCents)} from account ${template.creditAccount} to ${template.debitAccount}. AP and cash did not change.`);
    setLoaded(true);
  }
  function update(key:string,value:string|boolean) {setObserved(previous => ({...previous,[key]:value}));}
  async function submit(e:FormEvent) {
    e.preventDefault();setError("");
    if (!reference.trim() || notes.trim().length < 5 || keys.some(key => observed[key] === undefined || observed[key] === "" || typeof template[key] === "number" && !Number.isFinite(Number(observed[key])))) {
      setError("Completion details are incomplete. Load sample results for this demo, or complete Source details before confirming.");return;
    }
    const record = Object.fromEntries(keys.map(key => [key,typeof template[key] === "number" ? Math.round(Number(observed[key])*100) : typeof template[key] === "boolean" ? observed[key] === true : String(observed[key] || "")]));
    await onSubmit({action:"execute",reference,targetId:target,amountCents:Math.round(Number(amount)*100),notes,refreshedRecord:JSON.stringify(record)});
  }
  return <form className="form-stack" onSubmit={submit}><fieldset disabled={busy} className="form-stack">
    <div className="inline"><h3 className="grow">Approved correction</h3>{sampleAvailable && <Button variant="outline" size="sm" onClick={load}><Download size={14} />Load sample results</Button>}</div>
    <p>{approvedChange}</p>
    <p className="small muted">Make this change in the accounting system first. Then confirm it here with the correction reference and updated records.{sampleAvailable && " For this demo, load sample results instead."}</p>
    {error && <Notice>{error}</Notice>}
    {loaded ? <div className="sample-receipt" role="status"><strong>Sample results loaded — not confirmed</strong><p>Nothing has been posted to an accounting system.</p></div> : <p className="small muted">No completion details added yet.</p>}
    <label className="form-field">Correction reference<input value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference for the completed correction" /></label>
    <label className="form-field">What was done<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Which bill or account changed, and what stayed unchanged?" /></label>
    <details className="source-detail-fields"><summary>Source details</summary><div className="form-grid section-gap"><label className="form-field">Corrected transaction<input value={target} onChange={e => setTarget(e.target.value)} /></label><label className="form-field">Correction amount<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>{keys.map(key => typeof template[key] === "boolean" ? <label className="check-row full-width" key={key}><input type="checkbox" checked={observed[key] === true} onChange={e => update(key,e.target.checked)} />{key === "ledgerMatched" ? "Affected AP / GL records agree." : labels[key] || key}</label> : <label className="form-field" key={key}>{labels[key] || key}<input type={typeof template[key] === "number" ? "number" : "text"} step={typeof template[key] === "number" ? "0.01" : undefined} value={String(observed[key] ?? "")} onChange={e => update(key,e.target.value)} /></label>)}</div></details>
    <div className="actions"><Button type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={15} />}Confirm correction completed</Button></div>
  </fieldset></form>;
}
