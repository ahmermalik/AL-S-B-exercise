"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, CheckCircle2, FileSpreadsheet, Play, RotateCcw, TriangleAlert, UploadCloud } from "lucide-react";
import type { ImportSummary, PreparationReceipt, Run } from "@/shared/types";
import { CountUp, ease, fadeUp, spring } from "./motion";
import { api, useResource } from "@/lib/api";
import { dateTime } from "@/lib/ui";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { BackLink, ErrorState, Notice, Status } from "./common";
import { PageSkeleton } from "./skeleton";
type Preparation = { source: ImportSummary | null; run: Run | null; receipt: PreparationReceipt | null };
type UploadState = "idle" | "dragover" | "uploading" | "imported" | "error";
// Server stage names, with the label shown to reviewers.
const stages = [{ key: "Importing", label: "Import workbook" }, { key: "Checking", label: "Check source records" }, { key: "Investigating", label: "Investigate exceptions" }, { key: "Drafting", label: "Draft case analysis" }, { key: "Validating", label: "Validate drafts" }, { key: "Submitted", label: "Ready for review" }];
const scope = ["Invoice duplicates and coding exceptions", "Required commentary and approval evidence", "Property close progress and conflicting statuses", "Source-linked case analysis and follow-ups"];
function duration(ms: number) { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; }
export function PrepareReviewScreen() { return <PrepareContent />; }
function PrepareContent() {
  const resource = useResource<Preparation>("/api/preparation");
  const [busy, setBusy] = useState<"import" | "start" | "cancel" | "resume" | null>(null); const [error, setError] = useState(""); const [notices, setNotices] = useState(false);
  const [upload, setUpload] = useState<UploadState>("idle"); const [confirmCancel, setConfirmCancel] = useState(false); const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null); const openButton = useRef<HTMLAnchorElement>(null);
  const run = resource.data?.run; const source = resource.data?.source; const receipt = resource.data?.receipt;
  const active = run?.status === "running" || run?.status === "queued";
  // Announce completion and focus the review link only when this page watched the run finish.
  const [watchedRun, setWatchedRun] = useState<string | null>(null);
  if (active && run && watchedRun !== run.id) setWatchedRun(run.id);
  const justFinished = !!run && watchedRun === run.id && !active;
  useEffect(() => { if (!active) return; const timer = setInterval(resource.refresh, 1500); return () => clearInterval(timer); }, [active, resource.refresh]);
  useEffect(() => { if (!active) return; const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, [active]);
  useEffect(() => { if (justFinished) openButton.current?.focus({ preventScroll: true }); }, [justFinished]);
  async function importFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setUpload("error"); setError("Choose an Excel workbook (.xlsx)."); return; }
    setBusy("import"); setUpload("uploading"); setError(""); const body = new FormData(); body.append("file", file);
    try { await api<ImportSummary>("/api/preparation", { method: "POST", body }); resource.refresh(); setUpload("imported"); setTimeout(() => setUpload("idle"), 1600); }
    catch (error) { setUpload("error"); setError(error instanceof Error ? error.message : "Unable to import the workbook."); }
    finally { setBusy(null); if (input.current) input.current.value = ""; }
  }
  async function control(action: "start" | "cancel" | "resume") { setBusy(action); setError(""); setConfirmCancel(false); try { await api("/api/preparation", { method: "POST", body: JSON.stringify({ action, runId: run?.id, importId: source?.id }) }); resource.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to update preparation."); resource.refresh(); } finally { setBusy(null); } }
  function onDrop(event: DragEvent) { event.preventDefault(); if (active || busy) return; const file = event.dataTransfer.files?.[0]; if (file) void importFile(file); else setUpload("idle"); }
  if (!resource.data && resource.error) return <ErrorState error={resource.error} retry={resource.refresh} />;
  if (!resource.data) return <PageSkeleton variant="two" label="Loading preparation" />;
  const finishedRun = run?.status === "complete";
  const stageIndex = finishedRun ? stages.length : run?.status === "partial" ? stages.findIndex(s => s.key === "Drafting") : Math.max(0, stages.findIndex(stage => run?.stage.toLowerCase().includes(stage.key.toLowerCase())));
  const progress = run?.status === "partial" && run.totalCases > 0 ? Math.round(run.completedCases / run.totalCases * 100) : run?.progress || 0;
  const log = run?.stageLog || [];
  function stageTiming(key: string, index: number) {
    const entry = log.find(e => e.name === key); if (!entry) return null;
    const next = log.find(e => stages.findIndex(s => s.key === e.name) > index || e.name === "Review available");
    const end = next ? Date.parse(next.at) : index === stageIndex && active ? now : run ? Date.parse(run.updatedAt) : now;
    return duration(end - Date.parse(entry.at));
  }
  function stageMeta(key: string) {
    if (!source || !run) return null;
    return ({ Importing: `${source.counts.invoices} invoice rows`, Checking: `${source.counts.activeProperties} properties`, Investigating: run.totalCases ? `${run.totalCases} findings` : null, Drafting: run.totalCases ? `${run.completedCases} / ${run.totalCases} prepared` : null, Validating: run.totalCases ? `${run.completedCases} checked` : null, Submitted: null } as Record<string, string | null>)[key];
  }
  const elapsed = run ? duration((active ? now : Date.parse(run.updatedAt)) - Date.parse(run.createdAt)) : "";
  const zoneLabel = upload === "dragover" ? "Drop to import" : upload === "uploading" ? "Importing workbook…" : upload === "imported" ? "Workbook imported" : source ? source.filename : "Drop a close workbook here";
  return <><BackLink /><motion.header className="page-head" variants={fadeUp} initial="hidden" animate="show"><div><div className="eyebrow">{source?.period || "Month-end close"}</div><h1>Prepare review</h1>{run && <p>Last run {dateTime(run.createdAt)} · {elapsed}</p>}</div></motion.header>
    {error && <div className="section-gap"><Notice>{error}</Notice></div>}
    <div className="two-column section-gap prepare-layout"><div className="stack">
      <section className="panel panel--source"><div className="panel-head"><h2>Source workbook</h2></div><div className="panel-body">
        <label htmlFor="workbook-file" className="upload-zone" data-state={upload} aria-disabled={!!busy || active}
          onDragOver={e => { e.preventDefault(); if (!active && !busy) setUpload("dragover"); }} onDragLeave={() => upload === "dragover" && setUpload("idle")} onDrop={onDrop}>
          <motion.span className="upload-icon" animate={upload === "dragover" ? { y: -3, scale: 1.06 } : { y: 0, scale: 1 }} transition={spring}>
            <AnimatePresence mode="wait" initial={false}><motion.span key={upload === "imported" ? "ok" : upload === "error" ? "err" : source ? "file" : "up"} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.16 }}>{upload === "imported" ? <CheckCircle2 size={28} /> : upload === "error" ? <TriangleAlert size={28} /> : source ? <FileSpreadsheet size={28} /> : <UploadCloud size={28} />}</motion.span></AnimatePresence>
          </motion.span>
          <span className="grow"><strong className="upload-title">{zoneLabel}</strong><span className="small muted upload-sub">{source && upload === "idle" ? `${source.period} · as of BD${source.asOfBD} · imported ${dateTime(source.createdAt)}` : "Compatible Excel workbook (.xlsx) · drag and drop or browse"}</span></span>
          <span className="button button-outline button-small upload-browse">{source ? "Replace" : "Browse"}</span>
          {upload === "uploading" && <span className="upload-bar" aria-hidden="true" />}
          <input ref={input} id="workbook-file" className="sr-only" aria-label="Import workbook" type="file" accept=".xlsx" disabled={!!busy || active} onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); }} />
        </label>
        {source && <><div className="counts-grid"><div><strong><CountUp id="prep-activeProperties" value={source.counts.activeProperties} /></strong><span>active properties</span></div><div><strong><CountUp id="prep-invoices" value={source.counts.invoices} /></strong><span>invoice rows</span></div><div><strong><CountUp id="prep-variances" value={source.counts.variances} /></strong><span>budget categories</span></div><div><strong><CountUp id="prep-steps" value={source.counts.steps} /></strong><span>close tasks</span></div></div>{source.warnings.length > 0 && <button type="button" className="notice-chip" onClick={() => setNotices(true)}><TriangleAlert size={14} />{source.warnings.length} source {source.warnings.length === 1 ? "notice" : "notices"}</button>}</>}
      </div></section>
      <section className="panel"><div className="panel-head"><h2>Review scope</h2></div><div className="panel-body"><ul className="checklist">{scope.map(item => <li key={item}><Check size={15} /><div>{item}</div></li>)}</ul></div></section>
    </div>
      <section className="panel panel--analysis"><div className="panel-head"><h2>{active ? "Preparation in progress" : run ? "Preparation" : "Ready to prepare"}</h2>{run && <Status value={run.status} />}</div><div className="panel-body">{run ? <>
        <div className="run-progress"><div className="progress-track" role="progressbar" aria-label="Preparation progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${run.completedCases} of ${run.totalCases} cases prepared`}><motion.div className="progress-fill" style={{ originX: 0 }} initial={false} animate={{ scaleX: progress / 100 }} transition={active ? { duration: 1.5, ease: "linear" } : { duration: 0.5, ease }} /></div><span className="mono small">{progress}%</span></div>
        <ol className="stage-timeline">{stages.map((stage, index) => {
          const state = index < stageIndex ? "done" : index === stageIndex && active ? "active" : index === stageIndex && run.status === "partial" ? "blocked" : "todo";
          const meta = stageMeta(stage.key); const timing = stageTiming(stage.key, index);
          return <li key={stage.key} data-state={state} aria-current={state === "active" ? "step" : undefined}>
            <span className="stage-rail" aria-hidden="true"><motion.span className="stage-rail-fill" style={{ originY: 0 }} initial={false} animate={{ scaleY: index < stageIndex ? 1 : 0 }} transition={{ duration: 0.3, ease }} /></span>
            <span className="stage-dot">{state === "done" ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}><Check size={13} /></motion.span> : state === "blocked" ? "!" : index + 1}</span>
            <span className="stage-name">{stage.label}</span>
            <span className="stage-meta mono">{state !== "todo" && meta}{state !== "todo" && meta && timing && " · "}{state !== "todo" && timing}</span>
          </li>;
        })}</ol>
        {justFinished && finishedRun && <p className="sr-only" role="status">{run.totalCases} findings prepared. Open the workspace to review.</p>}
        {run.error && <Notice tone={run.status === "partial" ? "warning" : "error"}>{run.error}</Notice>}
        <div className="actions">{active ? (confirmCancel ? <><span className="small">Cancel this run?</span><Button variant="danger" size="sm" loading={busy === "cancel"} onClick={() => control("cancel")}>Cancel run</Button><Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>Keep running</Button></> : <Button variant="outline" disabled={!!busy} onClick={() => setConfirmCancel(true)}>Cancel preparation</Button>)
          : ["partial", "cancelled", "failed"].includes(run.status) ? <Button disabled={!!busy} loading={busy === "resume"} onClick={() => control("resume")}>{busy !== "resume" && <RotateCcw size={15} />}{run.status === "partial" ? "Retry drafting" : "Resume preparation"}</Button>
          : <Button variant="outline" disabled={!!busy || !source} loading={busy === "start"} onClick={() => control("start")}>Run again</Button>}
          {!active && <Button asChild><Link ref={openButton} href="/">{run.status === "complete" ? "Open workspace" : "Open available findings"}<ArrowRight size={15} /></Link></Button>}</div>
      </> : <>{!source && <p className="muted small">Import a workbook to begin.</p>}<ol className="stage-timeline stage-timeline--preview">{stages.map((stage, index) => <li key={stage.key} data-state="todo"><span className="stage-rail" aria-hidden="true" /><span className="stage-dot">{index + 1}</span><span className="stage-name">{stage.label}</span></li>)}</ol><div className="actions"><Button disabled={!source || !!busy} loading={busy === "start"} onClick={() => control("start")}>{busy !== "start" && <Play size={16} />}Start preparation</Button></div></>}</div></section></div>
    {receipt && <section className="panel section-gap" aria-labelledby="preparation-receipt-title"><div className="panel-head"><h2 id="preparation-receipt-title">Preparation receipt</h2><span className="small muted">Current workbook</span></div><div className="panel-body"><ul className="preparation-receipt">
      <li><strong>{receipt.screened.invoices}</strong><span>invoice rows screened for duplicates, coding and approval evidence</span></li>
      <li><strong>{receipt.screened.variances}</strong><span>budget/actual rows checked for required commentary</span></li>
      <li><strong>{receipt.screened.steps}</strong><span>close steps checked for overdue work and date conflicts</span></li>
      <li><strong>{receipt.findings}</strong><span>findings assembled · {receipt.sourceRecordsAttached} distinct original source rows attached</span></li>
      <li><strong>{receipt.currentAiAnalyses}</strong><span>current AI analyses with source links</span></li>
      <li><strong>{receipt.approvalInvoices}</strong><span>invoices grouped into {receipt.approvalProperties} property approval-evidence cases</span></li>
    </ul></div></section>}
    <Dialog open={notices} onOpenChange={setNotices} title="Source notices"><div className="stack">{source?.warnings.map((warning, index) => <Notice key={index} tone="warning">{warning}</Notice>)}</div></Dialog>
  </>;
}
