"use client";
import { useMemo, useState } from "react";
import { Select } from "./ui/select";
import { diffWordsWithSpace } from "diff";
import { motion } from "framer-motion";
import { Check, Circle, Cog, PenLine, Sparkles, X } from "lucide-react";
import type { CaseDetail, JournalLine, Proposal } from "@/shared/types";
import { money } from "@/lib/ui";
import { ease, spring } from "./motion";

/* ---------- Provenance ---------- */
export const originLabel = (origin: Proposal["origin"]) => origin === "ai" ? "AI draft" : origin === "manager" ? "Manager edit" : "Prepared from rules";
export function OriginChip({ origin }: { origin: Proposal["origin"] }) {
  const Icon = origin === "ai" ? Sparkles : origin === "manager" ? PenLine : Cog;
  return <span className="origin-chip" data-origin={origin}><Icon size={12} aria-hidden="true" />{originLabel(origin)}</span>;
}

/* ---------- Word-level diff ---------- */
export function TextDiff({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffWordsWithSpace(before || "", after || ""), [before, after]);
  if (before === after) return <p className="pre-wrap diff-text">{after || <span className="muted">Empty</span>}</p>;
  return <p className="pre-wrap diff-text">{parts.map((part, i) => part.added ? <ins key={i}>{part.value}</ins> : part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>)}</p>;
}
export function diffStats(before: string, after: string) {
  const parts = diffWordsWithSpace(before || "", after || "");
  const words = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;
  return { added: parts.filter(p => p.added).reduce((n, p) => n + words(p.value), 0), removed: parts.filter(p => p.removed).reduce((n, p) => n + words(p.value), 0) };
}
function DiffStat({ before, after }: { before: string; after: string }) {
  const { added, removed } = diffStats(before, after);
  if (!added && !removed) return <span className="diff-stat muted">No wording changes</span>;
  return <span className="diff-stat"><span className="diff-add">+{added} words</span><span className="diff-del">−{removed} words</span></span>;
}

/* ---------- Proposal comparison ---------- */
const sameJournal = (a: JournalLine[], b: JournalLine[]) => JSON.stringify(a.map(l => [l.account, l.debitCents, l.creditCents])) === JSON.stringify(b.map(l => [l.account, l.debitCents, l.creditCents]));
export function ProposalCompare({ proposals, initialFrom, initialTo }: { proposals: Proposal[]; initialFrom: string; initialTo: string }) {
  const [fromId, setFromId] = useState(initialFrom); const [toId, setToId] = useState(initialTo); const [mode, setMode] = useState<"changes" | "side">("changes");
  const from = proposals.find(p => p.id === fromId) || proposals[0]; const to = proposals.find(p => p.id === toId) || proposals[proposals.length - 1];
  const addedGaps = to.missing.filter(m => !from.missing.includes(m)); const removedGaps = from.missing.filter(m => !to.missing.includes(m));
  const journalSame = sameJournal(from.journal, to.journal);
  const versionSelect = (value: string, onChange: (v: string) => void, label: string) => <Select size="sm" aria-label={label} value={value} onValueChange={onChange} options={proposals.map(p => ({ value: p.id, label: `v${p.version} · ${originLabel(p.origin)}`, hint: `Evidence set ${p.evidenceVersion + 1}` }))} />;
  return <div className="compare">
    <div className="compare-bar"><div className="inline">{versionSelect(from.id, setFromId, "Compare from version")}<span className="muted">→</span>{versionSelect(to.id, setToId, "Compare to version")}</div>
      <div className="segmented" role="tablist" aria-label="Comparison view">{(["changes", "side"] as const).map(m => <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>{mode === m && <motion.span layoutId="compare-mode" className="segmented-thumb" transition={spring} />}<span>{m === "changes" ? "Changes" : "Side by side"}</span></button>)}</div></div>
    <div className="compare-facts"><span>Evidence set {from.evidenceVersion + 1} → {to.evidenceVersion + 1}</span><DiffStat before={`${from.route} ${from.summary} ${from.rationale}`} after={`${to.route} ${to.summary} ${to.rationale}`} />{(from.journal.length > 0 || to.journal.length > 0) && <span className={journalSame ? "fact-ok" : "fact-warn"}>{journalSame ? <><Check size={13} />Journal amounts unchanged</> : <>Journal amounts changed</>}</span>}</div>
    {mode === "changes" ? <div className="stack compare-body">
      <section><h3 className="group-label">Treatment</h3><TextDiff before={from.route} after={to.route} /></section>
      <section><h3 className="group-label">Summary</h3><TextDiff before={from.summary} after={to.summary} /></section>
      {(from.rationale || to.rationale) && <section><h3 className="group-label">Rationale</h3><TextDiff before={from.rationale} after={to.rationale} /></section>}
      {(addedGaps.length > 0 || removedGaps.length > 0) && <section><h3 className="group-label">Still required</h3><ul className="gap-diff">{removedGaps.map(g => <li key={`r${g}`} className="gap-removed"><Check size={13} />{g}</li>)}{addedGaps.map(g => <li key={`a${g}`} className="gap-added">+ {g}</li>)}</ul></section>}
    </div> : <div className="form-grid compare-body">{[from, to].map(p => <section key={p.id}><div className="inline"><h3>Version {p.version}</h3><OriginChip origin={p.origin} /></div><p className="small muted">Evidence set {p.evidenceVersion + 1}</p><p className="pre-wrap section-gap">{p.summary}</p>{p.rationale && <p className="small muted section-gap pre-wrap">{p.rationale}</p>}</section>)}</div>}
  </div>;
}

/* ---------- Case lifecycle ---------- */
const financialSteps = ["Evidence", "Manager review", "Approved", "Execution recorded", "Records checked", "Resolved"];
const evidenceSteps = ["Evidence", "Manager review", "Evidence accepted", "Resolved"];
function position(item: Pick<CaseDetail, "status" | "kind">) {
  const financial = item.kind === "duplicate" || item.kind === "coding";
  const steps = financial ? financialSteps : evidenceSteps;
  const map: Record<string, number> = financial ? { candidate: 0, awaiting_evidence: 0, ready: 1, approved: 3, executed: 4, verification_failed: 4, verified: 5, resolved: 6, dismissed: -1 } : { candidate: 0, awaiting_evidence: 0, ready: 1, verified: 3, resolved: 4, dismissed: -1 };
  return { steps, current: map[item.status] ?? 0 };
}
export function CaseProgress({ item }: { item: Pick<CaseDetail, "status" | "kind"> }) {
  const { steps, current } = position(item);
  const dismissed = current < 0; const done = current >= steps.length;
  const blocked = item.status === "awaiting_evidence"; const failed = item.status === "verification_failed";
  const pct = dismissed ? 0 : Math.min(1, current / (steps.length - 1));
  return <div className="case-progress" data-dismissed={dismissed || undefined}>
    <ol aria-label="Case progress">{steps.map((label, i) => {
      const state = dismissed ? "muted" : i < current || done ? "done" : i === current ? (failed ? "failed" : blocked ? "blocked" : "current") : "todo";
      return <li key={label} data-state={state} aria-current={state === "current" || state === "blocked" || state === "failed" ? "step" : undefined}>
        <span className="cp-dot">{state === "done" ? <Check size={12} /> : state === "failed" ? <X size={12} /> : state === "blocked" ? "!" : <Circle size={6} fill="currentColor" />}</span>
        <span className="cp-label">{label}</span>
      </li>;
    })}</ol>
    <span className="cp-track" aria-hidden="true"><motion.span className="cp-fill" style={{ originX: 0 }} initial={false} animate={{ scaleX: pct }} transition={{ duration: 0.5, ease }} /></span>
    <p className="cp-mobile small">{dismissed ? "Dismissed" : done ? "Resolved" : `Step ${current + 1} of ${steps.length} · ${steps[current]}`}</p>
  </div>;
}

/* ---------- Decision gates ---------- */
export function DecisionGates({ gates }: { gates: { label: string; met: boolean; detail?: string }[] }) {
  return <ul className="gate-list" aria-label="Approval requirements">{gates.map(g => <li key={g.label} data-met={g.met}>
    <span className="gate-icon" aria-hidden="true">{g.met ? <Check size={12} /> : <Circle size={8} />}</span>
    <span>{g.label}{g.detail && <span className="gate-detail"> · {g.detail}</span>}</span><span className="sr-only">{g.met ? "met" : "not met"}</span>
  </li>)}</ul>;
}

/* ---------- Journal ---------- */
export function JournalTable({ lines }: { lines: JournalLine[] }) {
  const debit = lines.reduce((n, l) => n + l.debitCents, 0); const credit = lines.reduce((n, l) => n + l.creditCents, 0); const balanced = debit === credit;
  return <div className="journal"><div className="journal-head"><h3>Journal entry draft</h3><span className="small muted">Not posted · amounts computed from source records</span></div>
    <table className="data-table journal-table"><thead><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
      <tbody>{lines.map((line, index) => <tr key={index}><td><span className="mono account-code">{line.account}</span><span className="sub">{line.name}</span></td><td className="text-right mono">{line.debitCents ? money(line.debitCents) : "—"}</td><td className="text-right mono">{line.creditCents ? money(line.creditCents) : "—"}</td></tr>)}</tbody>
      <tfoot><tr><td><span className={balanced ? "fact-ok" : "fact-warn"}>{balanced ? <><Check size={13} />Balanced</> : "Out of balance"}</span></td><td className="text-right mono">{money(debit)}</td><td className="text-right mono">{money(credit)}</td></tr></tfoot>
    </table></div>;
}
