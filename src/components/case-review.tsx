"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, History, Link2, Sparkles, ShieldCheck, ClipboardList } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { CaseDetail, Evidence, Workspace } from "@/shared/types";
import { ease, fadeUp, stagger } from "./motion";
import { CaseProgress, DecisionGates, JournalTable, OriginChip, ProposalCompare } from "./review-insights";
import { api, ApiError, useResource } from "@/lib/api";
import { caseReviewActivity } from "@/lib/case-review-activity";
import { caseReviewStage } from "@/lib/case-review-stage";
import { accountingCopy } from "@/lib/accounting-copy";
import { dateTime, displayId, money } from "@/lib/ui";
import { useUser } from "./shell";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Dialog } from "./ui/dialog";
import { BackLink, ErrorState, Notice, Status } from "./common";
import { PageSkeleton } from "./skeleton";
import { ExecutionForm, SupportForm, TextActionForm } from "./case-forms";
import { CaseEvidence } from "./case-evidence";
import { EvidenceRecord } from "./evidence-view";
type Modal = "request" | "support" | "execute" | "return" | "dismiss" | "edit" | "history" | "compare" | null;
function EvidenceDetails({ evidence, cited }: { evidence: Evidence; cited: boolean }) { return <div className="stack"><div className="evidence-meta"><span className="source-tag">{evidence.source ? "Original workbook" : "Supplementary support"}</span>{evidence.source && <span className="mono">{evidence.source.sheet} · row {evidence.source.row}</span>}<span>{evidence.author}</span><span>{dateTime(evidence.createdAt)}</span>{cited && <span className="cited-tag"><Link2 size={12} />Cited by current proposal</span>}</div><EvidenceRecord evidence={evidence} /></div>; }
function evidenceLabel(evidence: Evidence, all: Evidence[]) {
  const matches = all.filter(item => item.label === evidence.label);
  return matches.length > 1 ? `${evidence.label} · record ${matches.findIndex(item => item.id === evidence.id) + 1}` : evidence.label;
}
const kindLabel: Record<string, string> = { duplicate: "Duplicate invoice", coding: "GL coding", variance: "Variance commentary", approval: "Approval evidence", close: "Close blocker" };
const historyTone = (action: string) => /\bAI\b|draft/i.test(action) ? "ai" : /approv|accept|resolv|verif|pass/i.test(action) ? "decision" : /return|fail|dismiss/i.test(action) ? "alert" : "neutral";
export function CaseReviewScreen({ id }: { id: string }) { return <CaseContent key={id} id={id} />; }
function CaseContent({ id }: { id: string }) {
  const resource = useResource<CaseDetail>(`/api/cases/${id}`); const user = useUser(); const [busyAction, setBusyAction] = useState<string | null>(null); const busy = busyAction !== null; const [error, setError] = useState(""); const [modal, setModal] = useState<Modal>(null); const [evidence, setEvidence] = useState<Evidence | null>(null); const [selectedVersion, setSelectedVersion] = useState(""); const [reviewedKey, setReviewedKey] = useState("");
  const [hoveredSource, setHoveredSource] = useState<string | null>(null); const [arrived, setArrived] = useState<{ id: string; message: string } | null>(null);
  const refreshCase = resource.refresh;
  useEffect(() => {
    // Refresh the receiving account when switching windows; leave an open form untouched.
    if (busy || modal) return;
    const update = () => { if (document.visibilityState === "visible") refreshCase(); };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [busy, modal, refreshCase]);
  const item = resource.data; const latest = item?.proposals[item.proposals.length - 1]; const proposal = item?.proposals.find(p => p.id === selectedVersion) || latest;
  const stale = !!proposal && (proposal.id !== latest?.id || proposal.evidenceVersion !== item?.evidenceVersion); const manager = user?.role === "manager"; const accountant = user?.role === "accountant"; const reviewOpen = !!item && ["candidate", "awaiting_evidence", "ready"].includes(item.status); const reviewKey = item ? `${item.id}:${item.revision}:${proposal?.id || ""}:${item.evidenceVersion}` : ""; const reviewed = reviewedKey === reviewKey;
  async function perform(input: Record<string, unknown>): Promise<boolean> {
    if (!item) return false; setBusyAction(String(input.action)); setError(""); const previousLatest = latest?.id;
    try {
      const next = await api<CaseDetail>(`/api/cases/${id}/actions`, { method: "POST", body: JSON.stringify({ ...input, expectedRevision: item.revision }) });
      if (input.action === "support" && next.revision === item.revision) {
        setError("No changes were saved. Update the explanation or supporting records, then submit again. Use Revise with AI if only the recommendation wording needs to change.");
        return false;
      }
      resource.replace(next); setModal(null); setSelectedVersion(""); setReviewedKey("");
      const newest = next.proposals[next.proposals.length - 1];
      // Mark a newly drafted version so the reviewer sees exactly what changed.
      if (newest && newest.id !== previousLatest) setArrived({ id: newest.id, message: `Version ${newest.version} ${newest.origin === "ai" ? "drafted by AI" : "prepared"} from evidence set ${newest.evidenceVersion + 1}.` });
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "The case could not be updated."); if (error instanceof ApiError && error.status === 409) setModal(null); resource.refresh(); return false; }
    finally { setBusyAction(null); }
  }
  if (!item && resource.error) return <ErrorState error={resource.error} retry={resource.refresh} />;
  if (!item) return <PageSkeleton variant="three" label="Loading case" />;
  const displayedSummary = proposal ? (proposal.origin === "rules" && proposal.disposition === "pending" ? accountingCopy(proposal.summary) : proposal.summary) : "";
  const requestDefault = `Please provide the original invoice, source transaction IDs, posting/payment records, and the applicable period and correction authority for ${item.title}.`;
  const cited = new Set(proposal?.sources || []);
  const needsSupport = item.kind !== "variance" && !!latest && latest.missing.length > 0;
  const gates = latest ? [
    { label: "Latest version selected", met: proposal?.id === latest.id },
    { label: "Uses the latest supporting records", met: latest.evidenceVersion === item.evidenceVersion, detail: `evidence set ${item.evidenceVersion + 1}` },
    ...(item.kind !== "variance" ? [{ label: "Required support provided", met: !needsSupport, detail: needsSupport ? `${latest.missing.length} open` : undefined }] : []),
    { label: "You have confirmed your review", met: reviewed },
  ] : [];
  const stage = caseReviewStage(item);
  const activity = caseReviewActivity(item);
  const nextTask = stage === "needs_support" ? (manager ? "Ask the accountant for the missing records" : "Add the missing records")
    : stage === "changes_requested" ? (manager ? "Waiting for the accountant to update the recommendation" : "Update the recommendation using the manager’s feedback")
    : stage === "update_recommendation" ? "Update the recommendation using the latest records"
    : stage === "review" ? (accountant ? "Ready for the manager to review" : item.kind === "variance" ? "Review the explanation and accept the wording or request changes" : "Review the recommendation and approve it or request changes")
    : stage === "approved" ? (accountant ? "Record the correction after it is made in the accounting system" : "Waiting for the accountant to record the correction")
    : stage === "resolve" ? (manager ? "Review the checked records and confirm this issue is resolved" : "Ready for the manager to confirm resolution")
    : stage === "execution_check" ? (item.status === "verification_failed" ? "Investigate the differences in the recorded correction" : "Check the refreshed records against the approved correction")
    : stage === "closed" ? "Continue the review for this property" : accountingCopy(item.nextAction);
  const lastEvent = item.history[item.history.length - 1];
  const decisionLabel = item.kind === "variance" ? "Accept wording" : ["approval", "close"].includes(item.kind) ? "Accept evidence" : "Approve correction";
  const supportAndApproval = (<dl className="key-value case-activity section-gap" aria-label="Support and approval history">
          <dt>Support submitted by</dt><dd>{activity.support ? <>{activity.support.name}<time className="sub" dateTime={activity.support.at}>{dateTime(activity.support.at)}</time></> : "Not submitted"}</dd>
          <dt>{item.kind === "variance" ? "Wording accepted by" : ["approval", "close"].includes(item.kind) ? "Evidence accepted by" : "Approved by"}</dt><dd>{activity.approval ? <>{activity.approval.name}<time className="sub" dateTime={activity.approval.at}>{dateTime(activity.approval.at)}</time></> : "Not yet approved"}</dd>
        </dl>);
  const requestHistory = (item.requests.length > 0 && <div className="divider"><h3>Evidence requests</h3><ol className="mini-timeline">{item.requests.map(request => <li key={request.id}><p>{request.text}</p><span className="small muted">{request.author} · {dateTime(request.at)} · <Status value={request.status === "open" ? "awaiting_evidence" : "resolved"} label={request.status === "open" ? "Open" : request.status.charAt(0).toUpperCase() + request.status.slice(1)} /></span></li>)}</ol></div>);
  const executionRecord = (item.execution && <div className="divider"><div className="inline"><h3 className="grow">Execution record</h3><Status value={item.execution.verified ? "resolved" : "executed"} label={item.execution.verified ? "Check passed" : "Check pending"} /></div><dl className="key-value section-gap"><dt>Reference</dt><dd className="mono">{displayId(item.execution.reference)}</dd><dt>Transaction</dt><dd className="mono">{displayId(item.execution.targetId)}</dd><dt>Amount</dt><dd className="mono">{money(item.execution.amountCents)}</dd><dt>Recorded</dt><dd>{dateTime(item.execution.at)}</dd></dl></div>);
  return <><BackLink /><motion.header className="page-head case-head" variants={fadeUp} initial="hidden" animate="show"><div className="grow"><div className="eyebrow">{item.propertyName} · {item.propertyId} · {kindLabel[item.kind]}</div><h1>{item.title}</h1><div className="case-heading">{(item.kind !== "close" || item.amountCents > 0) && <span className="case-amount">{money(item.amountCents)}</span>}<Status value={item.status} /><span className="small muted">Owner · {item.owner}</span></div></div><div className="inline"><Button variant="outline" onClick={() => setModal("history")}><History size={15} />History</Button><Button variant="outline" asChild><Link href={`/packages?propertyId=${item.propertyId}`}>Review package<ArrowRight size={15} /></Link></Button></div></motion.header>
    <CaseProgress item={item} />
    <div className="sr-only" aria-live="polite">{arrived?.message}</div>
    {error && <div style={{ marginBottom: 18 }}><Notice>{error}</Notice></div>}
    <motion.div className="three-column case-review-layout" variants={stagger(0.08, 0.05)} initial="hidden" animate="show">
      <motion.section className="panel panel--analysis" variants={fadeUp}><div className="panel-head"><h2><ClipboardList size={19} />1. Finding & recommendation</h2>{item.proposals.length > 1 && <Select size="sm" aria-label="Proposal version" value={proposal?.id || ""} onValueChange={v => { setSelectedVersion(v); setReviewedKey(""); }} options={[...item.proposals].reverse().map(p => ({ value: p.id, label: `Version ${p.version}${p.id === latest?.id ? " · latest" : ""}`, hint: `${p.origin === "ai" ? "AI draft" : p.origin === "manager" ? "Manager edit" : "Rules"} · ${dateTime(p.createdAt)}` }))} />}</div><div className="panel-body"><AnimatePresence mode="wait" initial={false}><motion.div key={proposal?.id || "none"} className="proposal" data-arrived={arrived?.id === proposal?.id || undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease }}>{proposal ? <>
        <div className="proposal-meta"><Status value={item.status === "dismissed" ? "dismissed" : proposal.disposition === "approved" ? "resolved" : proposal.disposition} label={item.status === "dismissed" ? "Finding dismissed" : ({ pending: "Pending review", approved: "Approved", returned: "Changes requested" } as Record<string, string>)[proposal.disposition] || proposal.disposition} />{proposal.origin === "ai" && <OriginChip origin={proposal.origin} />}</div>
        {stale && <div className="section-gap"><Notice tone="warning">The supporting records have changed, or you are viewing an earlier recommendation. <button type="button" className="link-button" onClick={() => setSelectedVersion("")}>Show the latest version</button></Notice></div>}
        <div className="proposal-route"><h3>{proposal.route === "Evidence review" ? (item.kind === "duplicate" ? "Possible duplicate invoice" : "Check the supporting records") : proposal.route}</h3></div><p className="proposal-summary">{displayedSummary}</p>
        {proposal.missing.length > 0 && <div className="evidence-gap"><h3>Information still needed</h3><ul className="small">{proposal.missing.map((gap, i) => <li key={i}>{accountingCopy(gap)}</li>)}</ul></div>}
        {proposal.journal.length > 0 && <div className="divider"><JournalTable lines={proposal.journal} /></div>}

        <details className="finding-details"><summary>Supporting details</summary>{proposal.rationale && <div className="section-gap"><p className="pre-wrap">{proposal.origin === "rules" && proposal.disposition === "pending" ? accountingCopy(proposal.rationale) : proposal.rationale}</p></div>}{proposal.sources.length > 0 && <div className="source-chips"><span className="group-label">Records used ({proposal.sources.length})</span><div className="inline">{proposal.sources.map(sourceId => { const source = item.evidence.find(e => e.id === sourceId); return source ? <button type="button" key={sourceId} className="source-chip" onMouseEnter={() => setHoveredSource(sourceId)} onMouseLeave={() => setHoveredSource(null)} onFocus={() => { setHoveredSource(sourceId); }} onBlur={() => setHoveredSource(null)} onClick={() => setEvidence(source)}><FileText size={12} />{evidenceLabel(source, item.evidence)}</button> : null; })}</div></div>}<dl className="key-value section-gap"><dt>Supporting records</dt><dd>Version {proposal.evidenceVersion + 1}</dd><dt>Prepared</dt><dd><time dateTime={proposal.createdAt}>{dateTime(proposal.createdAt)}</time></dd></dl>{reviewOpen && <div className="actions"><Button variant="outline" size="sm" disabled={busy} loading={busyAction === "prepare"} onClick={() => perform({ action: "prepare" })}>{busyAction !== "prepare" && <FileText size={15} />}{busyAction === "prepare" ? "Refreshing…" : "Refresh recommendation"}</Button></div>}</details>
      </> : <p className="muted">Prepare an analysis from the available evidence.</p>}</motion.div></AnimatePresence>
        {busyAction === "revise-ai" && <div className="drafting-note" role="status"><Sparkles size={14} />Drafting from {item.evidence.length} evidence {item.evidence.length === 1 ? "record" : "records"}. The current version stays available.</div>}
        {(reviewOpen || item.proposals.length > 1) && <div className="actions finding-actions">{reviewOpen && <Button variant="outline" disabled={busy} loading={busyAction === "revise-ai"} onClick={() => perform({ action: "revise-ai" })}>{busyAction !== "revise-ai" && <Sparkles size={15} />}{busyAction === "revise-ai" ? "Drafting…" : "Revise with AI"}</Button>}{manager && reviewOpen && proposal && <Button variant="ghost" disabled={busy} onClick={() => setModal("edit")}>Edit wording</Button>}{item.proposals.length > 1 && <Button variant="ghost" disabled={busy} onClick={() => setModal("compare")}>Compare versions</Button>}{reviewOpen && !proposal && <Button variant="outline" disabled={busy} onClick={() => perform({action:"prepare"})}>Prepare proposal</Button>}</div>}
      </div></motion.section>
      <motion.section className="panel panel--evidence" variants={fadeUp}><div className="panel-head"><h2><FileText size={19} />2. Supporting records</h2></div><div className="panel-body"><CaseEvidence key={`${item.id}:${proposal?.evidenceVersion ?? item.evidenceVersion}`} item={item} evidenceVersion={proposal?.evidenceVersion ?? item.evidenceVersion} cited={cited} hoveredSource={hoveredSource} onInspect={setEvidence} /></div></motion.section>
      <motion.section className="panel panel--review handoff-panel" variants={fadeUp}><div className="panel-head"><h2><ShieldCheck size={19} />{stage === "closed" ? "3. Review complete" : "3. Next action"}</h2></div><div className="panel-body">
        {stage !== "closed" && <div className="review-next" data-attention={item.status === "candidate" || item.status === "awaiting_evidence"}><span className="group-label">Next action</span><AnimatePresence mode="wait" initial={false}><motion.div key={`${stage}:${item.nextAction}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><h3>{nextTask}</h3><p className="small owner-line"><span className="owner-avatar" aria-hidden="true">{item.owner.split(/[\s.]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("")}</span>{item.owner}</p></motion.div></AnimatePresence></div>}
        {(item.status === "resolved" || item.status === "dismissed") && <Notice tone="success">{item.status === "resolved" ? "This issue is resolved." : "This finding is dismissed."}{lastEvent && <span className="notice-meta">{lastEvent.actor} · {dateTime(lastEvent.at)}</span>}</Notice>}
        {stage !== "closed" && supportAndApproval}

        {stage === "changes_requested" && <div className="section-gap"><h3>Changes requested</h3><p className="small pre-wrap">{item.nextAction}</p>{accountant && <p className="small section-gap">Use Revise with AI to update the recommendation, or edit your submitted support to address the feedback.</p>}</div>}
        {stage === "approved" && manager && <p className="small section-gap">The accountant records the correction reference and updated records here after the authorized correction is made.</p>}
        {stage === "resolve" && accountant && <p className="small section-gap">The records check passed. The manager now reviews the result and confirms resolution.</p>}
        {reviewOpen && <div className="actions handoff-actions">{manager && stage === "needs_support" && <Button variant="default" size="sm" disabled={busy} onClick={() => setModal("request")}>Request evidence</Button>}{accountant && reviewOpen && <Button variant={stage === "needs_support" ? "default" : "outline"} size="sm" disabled={busy} onClick={() => setModal("support")}>{item.facts.support ? "Update support" : "Add support"}</Button>}{manager && reviewOpen && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setModal("dismiss")}>Dismiss finding</Button>}</div>}
        {manager && stage === "review" && latest && <div className="divider decision"><h3>Manager decision</h3><details className="section-gap"><summary>Review requirements</summary><DecisionGates gates={gates} /></details><label className="check-row section-gap"><input type="checkbox" checked={reviewed} onChange={e => setReviewedKey(e.target.checked ? reviewKey : "")} />I reviewed the current evidence, proposed treatment and correction authority.</label><div className="actions"><Button disabled={busy || !reviewed || stale || needsSupport || latest.disposition === "approved"} loading={busyAction === "approve"} onClick={() => perform({ action: "approve", proposalId: latest.id })}>{busyAction === "approve" ? "Recording decision…" : decisionLabel}</Button><Button variant="outline" disabled={busy} onClick={() => setModal("return")}>Request changes</Button></div></div>}
        {stage === "update_recommendation" && <div className="actions"><Button disabled={busy} loading={busyAction === "prepare"} onClick={() => perform({action:"prepare"})}>Update recommendation</Button></div>}
        {accountant && !reviewOpen && stage !== "closed" && <details className="section-gap"><summary>Additional actions</summary><div className="actions"><Button variant="outline" disabled={busy} onClick={() => setModal("support")}>Add support</Button></div></details>}
        {accountant && item.status === "approved" && <div className="actions"><Button disabled={busy || stale} onClick={() => setModal("execute")}>Record execution</Button></div>}
        {["executed", "verification_failed"].includes(item.status) && <div className="actions"><Button disabled={busy} loading={busyAction === "verify"} onClick={() => perform({ action: "verify" })}>{busyAction !== "verify" && <CheckCircle2 size={15} />}Check refreshed records</Button>{accountant && item.status === "verification_failed" && <Button variant="outline" disabled={busy} onClick={() => setModal("execute")}>Update execution record</Button>}</div>}
        {manager && item.status === "verified" && <div className="divider decision"><h3>Confirm resolution</h3><DecisionGates gates={[{ label: "Refreshed records checked", met: !item.execution || item.execution.verified }, { label: "You have confirmed your review", met: reviewed }]} /><label className="check-row section-gap"><input type="checkbox" checked={reviewed} onChange={e => setReviewedKey(e.target.checked ? reviewKey : "")} />I reviewed the correction reference and refreshed evidence.</label><div className="actions"><Button disabled={busy || !reviewed} loading={busyAction === "resolve"} onClick={() => perform({ action: "resolve" })}>Confirm issue resolved</Button></div></div>}


        {stage !== "closed" && <>{requestHistory}{executionRecord}</>}
        {stage === "closed" && <>
          <details className="completed-review-details"><summary>Review history</summary>{supportAndApproval}{requestHistory}{executionRecord}{accountant && <div className="actions"><Button variant="outline" disabled={busy} onClick={() => setModal("support")}>Add support</Button></div>}</details>
          <CaseNextSteps item={item} />
        </>}
        {!manager && !accountant && <Notice tone="warning">Your account has read-only access.</Notice>}
      </div></motion.section></motion.div>
    <Dialog open={!!evidence} onOpenChange={open => { if (!open) setEvidence(null); }} title={evidence?.label || "Evidence"} wide>{evidence && <EvidenceDetails evidence={evidence} cited={cited.has(evidence.id)} />}</Dialog>
    <Dialog open={!!modal} onOpenChange={open => { if (!open && !busy) setModal(null); }} description={modal === "return" ? `Describe what ${item.owner} needs to change. Your feedback is recorded in this shared case; no notification is sent.` : undefined} title={modal === "support" ? (item.facts.support ? "Update support" : "Add support") : modal === "execute" ? "Record execution" : modal === "request" ? "Request evidence" : modal === "return" ? "Request changes" : modal === "dismiss" ? "Dismiss finding" : modal === "edit" ? "Edit wording" : modal === "compare" ? "Compare versions" : "Case history"} wide={modal === "support" || modal === "execute" || modal === "compare"}>
      {modal === "support" && <SupportForm item={item} author={user?.name || ""} busy={busy} onSubmit={perform} />}{modal === "execute" && <ExecutionForm item={item} busy={busy} onSubmit={perform} />}{["request", "return", "dismiss", "edit"].includes(modal || "") && <TextActionForm key={modal} action={modal!} label={modal === "request" ? "Record request" : modal === "return" ? "Request changes" : modal === "dismiss" ? "Dismiss finding" : "Save wording"} initial={modal === "request" ? requestDefault : modal === "edit" ? displayedSummary : ""} busy={busy} onSubmit={perform} />}
      {modal === "history" && <ol className="history-timeline">{[...item.history].reverse().map(event => <li key={event.id} data-tone={historyTone(event.action)}><span className="ht-node" aria-hidden="true" /><div className="ht-body"><p><strong>{event.actor}</strong> {event.action}</p><time className="small muted mono" dateTime={event.at}>{dateTime(event.at)}</time></div></li>)}</ol>}
      {modal === "compare" && latest && item.proposals.length > 1 && <ProposalCompare proposals={item.proposals} initialFrom={(proposal && proposal.id !== latest.id ? proposal : item.proposals[item.proposals.length - 2]).id} initialTo={latest.id} />}
      {error && <div className="section-gap"><Notice>{error}</Notice></div>}
    </Dialog>
  </>;
}

function CaseNextSteps({ item }: { item: Pick<CaseDetail, "id" | "propertyId" | "propertyName" | "importId"> }) {
  const { data, error, refresh } = useResource<Workspace>("/api/workspace");
  if (!data && error) return <div className="section-gap"><ErrorState error="The remaining findings could not be loaded." retry={refresh} /></div>;
  if (!data) return <p className="small section-gap" role="status">Checking the remaining findings for {item.propertyName}…</p>;
  if (data.source?.id !== item.importId) return <div className="section-gap"><p className="small">The selected workbook has changed. Continue from the current workspace.</p><Button asChild variant="outline"><Link href="/">Open workspace</Link></Button></div>;
  const remaining = data.cases.filter(c => c.importId === item.importId && c.propertyId === item.propertyId && c.id !== item.id && !["dismissed", "resolved"].includes(c.status))
    .sort((a, b) => b.amountCents - a.amountCents || a.id.localeCompare(b.id));
  const next = remaining[0];
  return <section className="case-next-steps" aria-label="What to do next">
    <p className="small">{next ? `${remaining.length} other open ${remaining.length === 1 ? "finding remains" : "findings remain"} for ${item.propertyName}.` : `No open findings remain for ${item.propertyName}. Review the package before finishing the handoff.`}</p>
    {next && <p className="small section-gap">Next: {next.title}</p>}
    <div className="actions">{next && <Button asChild><Link href={`/cases/${next.id}`}>Review next finding<ArrowRight size={15} /></Link></Button>}
    <Button asChild variant={next ? "outline" : "default"}><Link href={`/packages?propertyId=${encodeURIComponent(item.propertyId)}`}>Open review package<ArrowRight size={15} /></Link></Button></div>
  </section>;
}
