"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, Lock, RefreshCw, Sparkles } from "lucide-react";
import type { AiUsage, Briefing, Operations, StageMatrix } from "@/shared/types";
import { api, useResource } from "@/lib/api";
import { dateTime } from "@/lib/ui";
import { Button } from "./ui/button";
import { ErrorState, Notice } from "./common";
import { OriginChip } from "./review-insights";

export type MatrixSelection = { accountant?: string; stage?: string };
/** Manager-only priorities briefing, AI usage and overdue-by-stage matrix. */
export function OperationsPanel({ selection, onLink, onSelect }: { selection: MatrixSelection; onLink: (key: string) => void; onSelect: (selection: MatrixSelection) => void }) {
  const resource = useResource<Operations>("/api/operations");
  const ops = resource.data;
  if (resource.error && !ops) return <ErrorState error={resource.error} retry={resource.refresh} />;
  return <section className="ops-grid" aria-label="Manager priorities">
    <section className="panel panel--analysis ops-briefing">
      <div className="panel-head"><h2><Sparkles size={18} aria-hidden="true" />Priorities</h2><span className="small muted ops-private"><Lock size={12} aria-hidden="true" />Accounting managers</span></div>
      <div className="panel-body">{ops ? <PrioritiesBriefing ops={ops} refresh={resource.refresh} onLink={onLink} /> : <p className="muted small">Loading priorities…</p>}{ops && <UsageLine usage={ops.usage} />}</div>
    </section>
    <section className="panel ops-matrix">
      <div className="panel-head"><div><h2>Overdue work by stage</h2><p className="small muted">Tracker as of BD{ops?.matrix.asOfBD ?? ""} · select a count to filter properties</p></div></div>
      {ops ? <MatrixTable matrix={ops.matrix} selection={selection} onSelect={onSelect} /> : <div className="panel-body"><p className="muted small">Loading…</p></div>}
    </section>
  </section>;
}

function PrioritiesBriefing({ ops, refresh, onLink }: { ops: Operations; refresh: () => void; onLink: (key: string) => void }) {
  const target = ops.briefing.fingerprint;
  const [result, setResult] = useState<{ fingerprint: string; briefing?: Briefing; error?: string } | null>(null);
  const requested = useRef<string | null>(null);
  const fresh = result?.fingerprint === target ? result : null;
  const shown = fresh?.briefing || ops.briefing.current;
  const needed = ops.ai.configured && shown?.fingerprint !== target;
  // Draft once per review state; a returned briefing for a newer state prompts a re-read of the facts.
  useEffect(() => {
    if (!needed || fresh || requested.current === target) return;
    requested.current = target;
    api<{ briefing: Briefing }>("/api/operations/briefing", { method: "POST" })
      .then(({ briefing }) => { setResult({ fingerprint: target, briefing }); if (briefing.fingerprint !== target) refresh(); })
      .catch(error => setResult({ fingerprint: target, error: error instanceof Error ? error.message : "The briefing could not be drafted." }));
  }, [needed, fresh, target, refresh]);
  function retry() { requested.current = null; setResult(null); }
  const drafting = needed && !fresh;
  if (!ops.ai.configured && !shown) return <p className="muted small">AI briefing is not configured. The attention items and the stage matrix are complete without it.</p>;
  return <div className="stack">
    {shown ? <ol className="briefing-list">{shown.items.map((item, i) => <li key={i}><p>{item.text}</p><div className="briefing-links">{item.links.map(key => {
      const label = shown.links[key] || key;
      return key === "commentary" ? <Link key={key} href="/cases?kind=variance" className="briefing-link">{label}<ArrowRight size={13} aria-hidden="true" /></Link>
        : <button key={key} type="button" className="briefing-link" onClick={() => onLink(key)}>{label}<ArrowRight size={13} aria-hidden="true" /></button>;
    })}</div></li>)}</ol> : drafting ? <p className="small muted inline" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true" />Drafting priorities from the current review state…</p> : null}
    {shown && <div className="briefing-meta small muted"><OriginChip origin="ai" /><span>{dateTime(shown.createdAt)}</span>{drafting && <span className="inline" role="status"><LoaderCircle size={13} className="spin" aria-hidden="true" />Updating for the latest review state</span>}{!ops.ai.configured && shown.fingerprint !== target && <span>Earlier review state</span>}</div>}
    {fresh?.error && <><Notice tone="warning">{fresh.error}</Notice><div><Button variant="outline" size="sm" onClick={retry}><RefreshCw size={14} />Try again</Button></div></>}
  </div>;
}

function UsageLine({ usage }: { usage: AiUsage }) {
  const parts: [number, string][] = [[usage.generated, "generated"], [usage.approved, "approved directly"], [usage.returned, "returned"], [usage.pending, "pending review"], [usage.superseded, "superseded"]];
  return <div className="usage-line divider">
    <p className="small"><span className="group-label">AI case drafts</span>{parts.map(([count, label]) => <span key={label} className="usage-part"><strong>{count}</strong> {label}</span>)}</p>
    <details className="usage-definitions small"><summary>Definitions</summary><dl className="key-value">
      <dt>Generated</dt><dd>AI-drafted proposal versions for the current workbook.</dd>
      <dt>Approved directly</dt><dd>The AI version itself was approved or accepted, without a manager rewrite.</dd>
      <dt>Returned</dt><dd>The AI version was returned with a reason.</dd>
      <dt>Pending review</dt><dd>The latest version in an open case, awaiting a decision.</dd>
      <dt>Superseded</dt><dd>Replaced by newer evidence or a manager edit, or its finding was dismissed, before a decision.</dd>
    </dl><p className="muted">Counts cover the current workbook. Adoption is judged across repeated closes.</p></details>
  </div>;
}

const heat = (overdue: number, due: number) => !overdue || !due ? 0 : overdue / due < 1 / 3 ? 1 : overdue / due < 2 / 3 ? 2 : 3;
function MatrixTable({ matrix, selection, onSelect }: { matrix: StageMatrix; selection: MatrixSelection; onSelect: (selection: MatrixSelection) => void }) {
  const isSelected = (accountant?: string, stage?: string) => selection.accountant === accountant && selection.stage === stage;
  return <div className="table-wrap"><table className="data-table matrix-table">
    <caption className="sr-only">Overdue close steps by staff accountant and stage, tracker as of business day {matrix.asOfBD}</caption>
    <thead><tr><th scope="col">Accountant</th>{matrix.stages.map(stage => <th scope="col" key={stage.name}>{stage.overdue ? <button type="button" className="matrix-head" aria-pressed={isSelected(undefined, stage.name)} onClick={() => onSelect({ stage: stage.name })}>{stage.name}</button> : <span className="matrix-head">{stage.name}</span>}<span className="sub">BD{stage.dueBD}</span></th>)}<th scope="col" className="text-right">Overdue</th></tr></thead>
    <tbody>{matrix.rows.map(row => <tr key={row.accountant}>
      <th scope="row">{row.overdue ? <button type="button" className="cell-link" aria-pressed={isSelected(row.accountant)} onClick={() => onSelect({ accountant: row.accountant })}>{row.accountant}</button> : row.accountant}<span className="sub">{row.properties} {row.properties === 1 ? "property" : "properties"}</span></th>
      {row.cells.map((cell, i) => { const stage = matrix.stages[i].name; return <td key={stage} className="matrix-cell" data-heat={heat(cell.overdue, cell.due)}>{cell.overdue
        ? <button type="button" aria-pressed={isSelected(row.accountant, stage)} aria-label={`${cell.overdue} of ${cell.due} ${stage} steps overdue for ${row.accountant}`} onClick={() => onSelect({ accountant: row.accountant, stage })}>{cell.overdue}</button>
        : <span className="muted" aria-label={`No ${stage} steps overdue for ${row.accountant}`}>–</span>}</td>; })}
      <td className="text-right mono">{row.overdue} of {row.due}<span className="sub">{Math.round(row.overdue / Math.max(1, row.due) * 100)}%</span></td>
    </tr>)}</tbody>
    <tfoot><tr><th scope="row">All</th>{matrix.stages.map(stage => <td key={stage.name} className="mono">{stage.overdue}</td>)}<td className="text-right mono">{matrix.overdue} of {matrix.due}</td></tr></tfoot>
  </table></div>;
}
