"use client";
import { useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Search, SearchX, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Workspace } from "@/shared/types";
import { ease, fadeUp, spring } from "./motion";
import { PageSkeleton } from "./skeleton";
import { useResource } from "@/lib/api";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Dialog } from "./ui/dialog";
import { ErrorState, Empty, Notice } from "./common";
import { CaseList } from "./case-list";
import { CloseStepCell } from "./close-step-cell";
import { describeCloseStep } from "@/lib/close-step";
import { AttentionStrip, type AttentionFilter } from "./attention-strip";
import { AmountReviewList } from "./amount-review";
import { OperationsPanel, type MatrixSelection } from "./operations-panel";
import { useUser } from "./shell";
const shortSteps = ["Bank", "AP", "Rent/AR", "Payroll", "Prepaid", "Variance", "Draft", "Final"];
const filters = ["all", "followup", "late", "evidence", "commentary", "threshold", "offboarded"] as const;
type Filter = (typeof filters)[number];
interface View { filter: Filter; accountant: string | null; stage: string | null; amounts: boolean }
const paginationScope = (view: View, property: string | null) => JSON.stringify([view.filter, view.accountant, view.stage, property]);
const isLate = (status: string) => status.toLowerCase() === "late";
export function WorkspaceScreen() {
  return <WorkspaceContent />;
}
const stateStatus: Record<string, string> = { complete: "complete", late: "failed", conflict: "failed", due: "partial", pending: "queued" };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const PAGE = 10;
function WorkspaceContent() {
  const { data, error, refresh } = useResource<Workspace>("/api/workspace");
  const manager = useUser()?.role === "manager";
  const params = useSearchParams();
  const view = useMemo<View>(() => ({
    filter: (filters as readonly string[]).includes(params.get("filter") || "") ? params.get("filter") as Filter : "all",
    accountant: params.get("accountant") || null,
    stage: params.get("stage") || null,
    amounts: params.get("view") === "amounts",
  }), [params]);
  const selectedId = params.get("property") || null;
  const scope = paginationScope(view, selectedId);
  const [pagination, setPagination] = useState<{ scope: string; page: number } | null>(null);
  const [stepIndex, setStepIndex] = useState(1);
  const [search, setSearch] = useState(""); const [showSource, setShowSource] = useState(false);
  const detailRef = useRef<HTMLElement>(null); const gridRef = useRef<HTMLElement>(null);
  const followUp = useMemo(() => new Set(data?.attention?.followUp.propertyIds || []), [data]);
  const thresholdDue = useMemo(() => new Set(data?.attention?.commentary.thresholdReviews.map(t => t.propertyId) || []), [data]);
  const commentaryDue = useMemo(() => new Set(data?.attention?.commentary.discrepancies.filter(d => d.categories.some(c => c.review === "missing")).map(d => d.propertyId) || []), [data]);
  const filtered = useMemo(() => (data?.properties || [])
    .filter(p => view.filter === "offboarded" ? !p.active : p.active)
    .filter(p => ({ followup: followUp.has(p.id), late: p.lateCount > 0, evidence: p.caseCount > 0, commentary: commentaryDue.has(p.id), threshold: thresholdDue.has(p.id) } as Record<string, boolean>)[view.filter] ?? true)
    .filter(p => !view.accountant || p.accountant === view.accountant)
    .filter(p => !view.stage || p.steps.some(s => s.name === view.stage && isLate(s.status)))
    .filter(p => `${p.name} ${p.region} ${p.accountant}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.lateCount - a.lateCount || a.name.localeCompare(b.name)), [data, view, search, followUp, thresholdDue, commentaryDue]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE) - 1);
  const selectedIndex = filtered.findIndex(p => p.id === selectedId);
  // Manual paging is scoped to the current filters/selection; deep links reveal their selected property.
  const currentPage = pagination?.scope === scope ? Math.min(pagination.page, lastPage) : selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE) : 0;
  const visible = filtered.slice(currentPage * PAGE, currentPage * PAGE + PAGE);
  // Selection always points at a property the user can see in the current results.
  const selected = filtered.find(p => p.id === selectedId) || visible[0];
  const selectedStep = selected?.steps[stepIndex];
  const cases = (data?.cases || []).filter(c => c.propertyId === selected?.id);
  const stepDetail = selectedStep && data?.source ? describeCloseStep(selectedStep, data.source.asOfBD) : null;
  const selectedStepCase = stepDetail && ["late", "conflict"].includes(stepDetail.state) ? cases.find(c => c.kind === "close") : undefined;
  function commit(next: View, property: string | null = selectedId) {
    if (next.filter !== view.filter || next.accountant !== view.accountant || next.stage !== view.stage) setPagination({ scope: paginationScope(next, property), page: 0 });
    const params = new URLSearchParams();
    if (next.filter !== "all") params.set("filter", next.filter);
    if (next.accountant) params.set("accountant", next.accountant);
    if (next.stage) params.set("stage", next.stage);
    if (property) params.set("property", property);
    if (next.amounts) params.set("view", "amounts");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }
  const reveal = (ref: RefObject<HTMLElement | null>) => requestAnimationFrame(() => { const el = ref.current; if (el && (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().top > window.innerHeight - 120)) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
  function applyFilter(next: Filter) { commit({ filter: next, accountant: null, stage: null, amounts: false }); }
  function toggleAttention(next: AttentionFilter) { applyFilter(view.filter === next && !view.accountant && !view.stage ? "all" : next); reveal(gridRef); }
  function selectMatrix(selection: MatrixSelection) {
    const same = view.filter === "late" && view.accountant === (selection.accountant || null) && view.stage === (selection.stage || null);
    setSearch(""); commit(same ? { filter: "all", accountant: null, stage: null, amounts: false } : { filter: "late", accountant: selection.accountant || null, stage: selection.stage || null, amounts: false }); reveal(gridRef);
  }
  function openLink(key: string) {
    const separator = key.indexOf(":"), kind = separator < 0 ? key : key.slice(0, separator), value = separator < 0 ? "" : key.slice(separator + 1);
    setSearch("");
    if (kind === "amounts") return commit({ ...view, amounts: true });
    if (kind === "property") { commit({ filter: "all", accountant: null, stage: null, amounts: false }, value); setPagination(null); return reveal(detailRef); }
    const next: Filter = kind === "followup" ? "followup" : kind === "threshold" ? "threshold" : "late";
    commit({ filter: next, accountant: kind === "accountant" ? value : null, stage: kind === "stage" ? value : null, amounts: false }); reveal(gridRef);
  }
  function selectProperty(id: string) {
    commit(view, id); setPagination(null);
    // Bring the detail panel into view when it is off-screen, so the click visibly does something.
    requestAnimationFrame(() => { const el = detailRef.current; if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }
  function changePage(next: number) { setPagination({ scope, page: next }); }
  if (error && !data) return <ErrorState error={error} retry={refresh} />;
  if (!data) return <PageSkeleton variant="workspace" label="Loading workspace" />;
  if (!data.source) return <><div className="page-head"><div><div className="eyebrow">Property accounting</div><h1>Close workspace</h1></div></div><div className="panel"><Empty title="Start your close review"><p>Import the workbook to open property progress and prepare findings.</p><Button asChild><Link href="/prepare">Import workbook<ArrowRight size={16} /></Link></Button></Empty></div></>;
  const attentionFilter = !view.accountant && !view.stage && ["followup", "commentary", "threshold"].includes(view.filter) ? view.filter : null;
  return <>
    <motion.header className="page-head" variants={fadeUp} initial="hidden" animate="show"><div><div className="eyebrow">{data.source.period} · As of business day {data.source.asOfBD}</div><h1>Close workspace</h1><p>Owner reports due BD8</p></div><div className="inline"><Button variant="ghost" onClick={() => setShowSource(true)}>Source details</Button><Button asChild><Link href="/prepare">Prepare review<ArrowRight size={16} /></Link></Button></div></motion.header>
    {error && <ErrorState error={error} retry={refresh} />}
    {data.attention && <AttentionStrip attention={data.attention} active={attentionFilter} onFilter={toggleAttention} onAmounts={() => commit({ ...view, amounts: true })} />}
    {manager && <OperationsPanel selection={{ accountant: view.filter === "late" ? view.accountant || undefined : undefined, stage: view.filter === "late" ? view.stage || undefined : undefined }} onLink={openLink} onSelect={selectMatrix} />}
    <section ref={gridRef} className="panel"><div className="panel-head"><h2>Property close progress</h2><div className="toolbar">{(view.accountant || view.stage) && <div className="filter-chips">{view.accountant && <button type="button" className="filter-chip" aria-label={`Remove ${view.accountant} filter`} onClick={() => commit({ ...view, accountant: null })}>{view.accountant}<X size={12} aria-hidden="true" /></button>}{view.stage && <button type="button" className="filter-chip" aria-label={`Remove ${view.stage} filter`} onClick={() => commit({ ...view, stage: null })}>{view.stage}<X size={12} aria-hidden="true" /></button>}</div>}<label className="search-field"><Search size={15} aria-hidden="true" /><input value={search} aria-label="Find property" placeholder="Find property or accountant" onChange={e => { setSearch(e.target.value); changePage(0); }} onKeyDown={e => { if (e.key === "Escape") setSearch(""); }} />{search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label><Select aria-label="Property filter" value={view.filter} onValueChange={value => applyFilter(value as Filter)} options={[{ value: "all", label: "Active properties", count: data.metrics.activeProperties }, { value: "followup", label: "Needs close follow-up", count: followUp.size }, { value: "late", label: "Overdue steps", count: data.metrics.lateProperties }, { value: "commentary", label: "Commentary gaps", count: commentaryDue.size }, { value: "threshold", label: "Threshold review due", count: thresholdDue.size }, { value: "evidence", label: "With findings", count: data.properties.filter(p => p.active && p.caseCount > 0).length }, { value: "offboarded", label: "Offboarded properties", count: data.properties.filter(p => !p.active).length }]} /></div></div>
      <div className="table-wrap"><table className="data-table property-table"><colgroup><col className="col-property" />{shortSteps.map(name => <col key={name} className="col-step" />)}<col /></colgroup><thead><tr><th>Property</th>{shortSteps.map((name, i) => <th key={name}>{name}<span title={`Business day ${(filtered[0]?.steps[i]?.dueBD) || [3, 3, 4, 4, 5, 6, 7, 8][i]} of the close cycle`}>BD{(filtered[0]?.steps[i]?.dueBD) || [3, 3, 4, 4, 5, 6, 7, 8][i]}</span></th>)}<th>Next action</th></tr></thead>
      <motion.tbody key={`${currentPage}-${view.filter}-${view.accountant}-${view.stage}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>{visible.map(property => { const isSelected = selected?.id === property.id; return <tr key={property.id} className={isSelected ? "selected-row" : ""}><td>{isSelected && <motion.span layoutId="row-indicator" className="row-indicator" transition={spring} />}<button className="cell-link" aria-pressed={isSelected} onClick={() => selectProperty(property.id)}>{property.name}</button><span className="sub">{property.accountant} · {property.steps.filter(s => s.status.toLowerCase() === "complete").length}/8 reported</span></td>{shortSteps.map((_, i) => { const step = property.steps[i]; if (!step) return <td key={i}><span className="muted">—</span></td>;
        return <td key={step.name}><CloseStepCell property={property} step={step} asOfBD={data.source!.asOfBD} selected={isSelected && stepIndex === i} onSelect={() => { commit(view, property.id); setPagination(null); setStepIndex(i); }} caseId={data.cases.find(c => c.propertyId === property.id && c.kind === "close")?.id} /></td>;
      })}<td>{property.lateCount ? `${plural(property.lateCount, "overdue step")}` : thresholdDue.has(property.id) ? "Threshold review due" : property.caseCount ? `${plural(property.caseCount, "finding")} to review` : "On schedule"}{property.steps.some(s => s.conflict) && <span className="sub">Completion date conflict</span>}</td></tr>; })}</motion.tbody></table></div>
      {!filtered.length && <Empty title="No matching properties" icon={SearchX}><Button variant="outline" size="sm" onClick={() => { setSearch(""); applyFilter("all"); }}>Clear search and filters</Button></Empty>}
      <div className="table-foot"><div className="legend"><span><i className="step-cell step-complete step-mini">✓</i>Reported complete</span><span><i className="step-cell step-late step-mini">!</i>Overdue</span><span><i className="step-cell step-due step-mini">○</i>Due today</span><span><i className="step-cell step-mini">–</i>Not due</span><span><i className="step-cell step-conflict step-mini">?</i>Data conflict</span><span className="legend-key">BD = business day</span></div><div className="inline"><span>{filtered.length ? currentPage * PAGE + 1 : 0}–{Math.min((currentPage + 1) * PAGE, filtered.length)} of {filtered.length}</span><Button variant="outline" size="sm" disabled={!currentPage} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={14} />Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * PAGE >= filtered.length} onClick={() => changePage(currentPage + 1)}>Next<ChevronRight size={14} /></Button></div></div></section>
    {selected && <section ref={detailRef} className="panel selected-property section-gap" id="cases"><div className="panel-head"><div><h2>{selected.name}</h2><div className="small muted">{selected.id} · {selected.region} · {selected.accountant}</div></div><Button variant="outline" size="sm" asChild><Link href={`/packages?propertyId=${selected.id}`}>Review package<ArrowRight size={14} /></Link></Button></div>
      <div className="property-details"><AnimatePresence mode="wait" initial={false}><motion.section key={`${selected.id}-${stepIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease }}><h3 className="detail-title">{selectedStep?.name || "Close progress"}</h3>{selectedStep && stepDetail ? <div className="inline"><span className={`status status-${stateStatus[stepDetail.state] || "queued"}`}>{stepDetail.label}</span><span className="small muted">Due BD{selectedStep.dueBD}{selectedStep.completedBD ? ` · reported complete BD${selectedStep.completedBD}` : ""}</span></div> : <p className="small muted">No close tasks recorded in this snapshot.</p>}{stepDetail && <p className="small section-gap">{stepDetail.description}</p>}<div className="actions"><Button variant="outline" size="sm" onClick={() => setShowSource(true)}>Inspect source</Button>{selectedStepCase && <Button variant="ghost" size="sm" asChild><Link href={`/cases/${selectedStepCase.id}`}>Review close blocker<ArrowRight size={14} /></Link></Button>}</div></motion.section></AnimatePresence>
      <AnimatePresence mode="wait" initial={false}><motion.section key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease }}><h3 className="detail-title">Findings to review</h3><CaseList cases={cases} /></motion.section></AnimatePresence></div></section>}
    <Dialog open={showSource} onOpenChange={setShowSource} title="Source details"><div className="detail-group"><h3 className="group-label">Workbook</h3><dl className="key-value"><dt>File</dt><dd>{data.source.filename}</dd><dt>Period</dt><dd>{data.source.period}</dd><dt>Snapshot</dt><dd>Business day {data.source.asOfBD}</dd></dl></div>{selected && selectedStep && <div className="detail-group divider"><h3 className="group-label">Selected step</h3><dl className="key-value"><dt>Property</dt><dd>{selected.name}</dd><dt>Close step</dt><dd>{selectedStep.name}</dd><dt>Source</dt><dd className="mono">{selectedStep.source.sheet} · row {selectedStep.source.row}</dd><dt>Reported status</dt><dd>{selectedStep.status}</dd></dl></div>}{data.source.warnings.length > 0 && <div className="divider stack"><h3 className="group-label">Source notices</h3>{data.source.warnings.map((warning, i) => <Notice key={i} tone="warning">{warning}</Notice>)}</div>}</Dialog>
    {data.attention && <Dialog open={view.amounts} onOpenChange={open => commit({ ...view, amounts: open })} title="Invoices flagged for amount verification" wide><AmountReviewList amounts={data.attention.amounts} /></Dialog>}
  </>;
}
