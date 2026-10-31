"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Search, SearchX, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Workspace } from "@/shared/types";
import { CountUp, ease, fadeUp, spring } from "./motion";
import { PageSkeleton } from "./skeleton";
import { useResource } from "@/lib/api";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Dialog } from "./ui/dialog";
import { ErrorState, Empty, Notice } from "./common";
import { CaseList } from "./case-list";
import { CloseStepCell } from "./close-step-cell";
import { describeCloseStep } from "@/lib/close-step";
const shortSteps = ["Bank", "AP", "Rent/AR", "Payroll", "Prepaid", "Variance", "Draft", "Final"];
export function WorkspaceScreen() {
  return <WorkspaceContent />;
}
const stateStatus: Record<string, string> = { complete: "complete", late: "failed", conflict: "failed", due: "partial", pending: "queued" };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const PAGE = 10;
function WorkspaceContent() {
  const { data, error, refresh } = useResource<Workspace>("/api/workspace");
  const [selectedId, setSelectedId] = useState<string | null>(null); const [stepIndex, setStepIndex] = useState(1);
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState(""); const [page, setPage] = useState(0); const [showSource, setShowSource] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const filtered = useMemo(() => (data?.properties || []).filter(p => filter === "offboarded" ? !p.active : p.active).filter(p => filter === "late" ? p.lateCount > 0 : filter === "evidence" ? p.caseCount > 0 : filter === "commentary" ? p.commentaryGaps > 0 : true).filter(p => `${p.name} ${p.region} ${p.accountant}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.lateCount - a.lateCount || a.name.localeCompare(b.name)), [data, filter, search]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE) - 1));
  const visible = filtered.slice(currentPage * PAGE, currentPage * PAGE + PAGE);
  // Selection always points at a property the user can see in the current results.
  const selected = filtered.find(p => p.id === selectedId) || visible[0];
  const selectedStep = selected?.steps[stepIndex];
  const cases = (data?.cases || []).filter(c => c.propertyId === selected?.id);
  const stepDetail = selectedStep && data?.source ? describeCloseStep(selectedStep, data.source.asOfBD) : null;
  const selectedStepCase = stepDetail && ["late", "conflict"].includes(stepDetail.state) ? cases.find(c => c.kind === "close") : undefined;
  function applyFilter(next: string) { setFilter(next); setPage(0); }
  function selectProperty(id: string) {
    setSelectedId(id);
    // Bring the detail panel into view when it is off-screen, so the click visibly does something.
    requestAnimationFrame(() => { const el = detailRef.current; if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }
  if (error && !data) return <ErrorState error={error} retry={refresh} />;
  if (!data) return <PageSkeleton variant="workspace" label="Loading workspace" />;
  if (!data.source) return <><div className="page-head"><div><div className="eyebrow">Property accounting</div><h1>Close workspace</h1></div></div><div className="panel"><Empty title="Start your close review"><p>Import the workbook to open property progress and prepare findings.</p><Button asChild><Link href="/prepare">Import workbook<ArrowRight size={16} /></Link></Button></Empty></div></>;
  const stats = [
    { id: "all", value: data.metrics.activeProperties, label: "properties", tone: undefined, context: "active this close" },
    { id: "late", value: data.metrics.lateProperties, label: "with overdue steps", tone: "danger", context: `${Math.round(data.metrics.lateProperties / Math.max(1, data.metrics.activeProperties) * 100)}% of properties` },
    { id: "commentary", value: data.metrics.commentaryGaps, label: "commentary gaps", tone: "warning", context: "variance explanations" },
    { id: "evidence", value: data.metrics.openCases, label: "open findings", tone: "info", context: `across ${plural(new Set(data.cases.filter(c => !["resolved", "dismissed"].includes(c.status)).map(c => c.propertyId)).size, "property").replace("propertys", "properties")}` },
  ];
  return <>
    <motion.header className="page-head" variants={fadeUp} initial="hidden" animate="show"><div><div className="eyebrow">{data.source.period} · As of business day {data.source.asOfBD}</div><h1>Close workspace</h1><p>Owner reports due BD8</p></div><Button asChild><Link href="/prepare">Prepare review<ArrowRight size={16} /></Link></Button></motion.header>
    {error && <ErrorState error={error} retry={refresh} />}
    <section className="stat-strip"><div className="stat-group" role="group" aria-label="Filter properties">{stats.map(stat => <button key={stat.id} type="button" className="stat" data-tone={stat.tone} aria-pressed={stat.id !== "all" && filter === stat.id} onClick={() => applyFilter(filter === stat.id && stat.id !== "all" ? "all" : stat.id)}><strong><CountUp id={`ws-${stat.id}`} value={stat.value} /></strong><span>{stat.label}</span><small className="stat-context">{stat.context}</small></button>)}</div><Button variant="ghost" size="sm" onClick={() => setShowSource(true)}>Source details<ArrowRight size={14} /></Button></section>
    <section className="panel"><div className="panel-head"><h2>Property close progress</h2><div className="toolbar"><label className="search-field"><Search size={15} aria-hidden="true" /><input value={search} aria-label="Find property" placeholder="Find property or accountant" onChange={e => { setSearch(e.target.value); setPage(0); }} onKeyDown={e => { if (e.key === "Escape") setSearch(""); }} />{search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label><Select aria-label="Property filter" value={filter} onValueChange={applyFilter} options={[{ value: "all", label: "Active properties", count: data.metrics.activeProperties }, { value: "late", label: "Overdue steps", count: data.metrics.lateProperties }, { value: "evidence", label: "With findings", count: data.properties.filter(p => p.active && p.caseCount > 0).length }, { value: "commentary", label: "Commentary gaps", count: data.properties.filter(p => p.active && p.commentaryGaps > 0).length }, { value: "offboarded", label: "Offboarded properties", count: data.properties.filter(p => !p.active).length }]} /></div></div>
      <div className="table-wrap"><table className="data-table property-table"><colgroup><col className="col-property" />{shortSteps.map(name => <col key={name} className="col-step" />)}<col /></colgroup><thead><tr><th>Property</th>{shortSteps.map((name, i) => <th key={name}>{name}<span title={`Business day ${(filtered[0]?.steps[i]?.dueBD) || [3, 3, 4, 4, 5, 6, 7, 8][i]} of the close cycle`}>BD{(filtered[0]?.steps[i]?.dueBD) || [3, 3, 4, 4, 5, 6, 7, 8][i]}</span></th>)}<th>Next action</th></tr></thead>
      <motion.tbody key={`${currentPage}-${filter}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>{visible.map(property => { const isSelected = selected?.id === property.id; return <tr key={property.id} className={isSelected ? "selected-row" : ""}><td>{isSelected && <motion.span layoutId="row-indicator" className="row-indicator" transition={spring} />}<button className="cell-link" aria-pressed={isSelected} onClick={() => selectProperty(property.id)}>{property.name}</button><span className="sub">{property.accountant} · {property.steps.filter(s => s.status.toLowerCase() === "complete").length}/8 reported</span></td>{shortSteps.map((_, i) => { const step = property.steps[i]; if (!step) return <td key={i}><span className="muted">—</span></td>;
        return <td key={step.name}><CloseStepCell property={property} step={step} asOfBD={data.source!.asOfBD} selected={isSelected && stepIndex === i} onSelect={() => { setSelectedId(property.id); setStepIndex(i); }} caseId={data.cases.find(c => c.propertyId === property.id && c.kind === "close")?.id} /></td>;
      })}<td>{property.lateCount ? `${plural(property.lateCount, "overdue step")}` : property.caseCount ? `${plural(property.caseCount, "finding")} to review` : "On schedule"}{property.steps.some(s => s.conflict) && <span className="sub">Completion date conflict</span>}</td></tr>; })}</motion.tbody></table></div>
      {!filtered.length && <Empty title="No matching properties" icon={SearchX}><Button variant="outline" size="sm" onClick={() => { setSearch(""); applyFilter("all"); }}>Clear search and filters</Button></Empty>}
      <div className="table-foot"><div className="legend"><span><i className="step-cell step-complete step-mini">✓</i>Reported complete</span><span><i className="step-cell step-late step-mini">!</i>Overdue</span><span><i className="step-cell step-due step-mini">○</i>Due today</span><span><i className="step-cell step-mini">–</i>Not due</span><span><i className="step-cell step-conflict step-mini">?</i>Data conflict</span><span className="legend-key">BD = business day</span></div><div className="inline"><span>{filtered.length ? currentPage * PAGE + 1 : 0}–{Math.min((currentPage + 1) * PAGE, filtered.length)} of {filtered.length}</span><Button variant="outline" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} />Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * PAGE >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={14} /></Button></div></div></section>
    {selected && <section ref={detailRef} className="panel selected-property section-gap" id="cases"><div className="panel-head"><div><h2>{selected.name}</h2><div className="small muted">{selected.id} · {selected.region} · {selected.accountant}</div></div><Button variant="outline" size="sm" asChild><Link href={`/packages?propertyId=${selected.id}`}>Review package<ArrowRight size={14} /></Link></Button></div>
      <div className="property-details"><AnimatePresence mode="wait" initial={false}><motion.section key={`${selected.id}-${stepIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease }}><h3 className="detail-title">{selectedStep?.name || "Close progress"}</h3>{selectedStep && stepDetail ? <div className="inline"><span className={`status status-${stateStatus[stepDetail.state] || "queued"}`}>{stepDetail.label}</span><span className="small muted">Due BD{selectedStep.dueBD}{selectedStep.completedBD ? ` · reported complete BD${selectedStep.completedBD}` : ""}</span></div> : <p className="small muted">No close tasks recorded in this snapshot.</p>}{stepDetail && <p className="small section-gap">{stepDetail.description}</p>}<div className="actions"><Button variant="outline" size="sm" onClick={() => setShowSource(true)}>Inspect source</Button>{selectedStepCase && <Button variant="ghost" size="sm" asChild><Link href={`/cases/${selectedStepCase.id}`}>Review close blocker<ArrowRight size={14} /></Link></Button>}</div></motion.section></AnimatePresence>
      <AnimatePresence mode="wait" initial={false}><motion.section key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease }}><h3 className="detail-title">Findings to review</h3><CaseList cases={cases} /></motion.section></AnimatePresence></div></section>}
    <Dialog open={showSource} onOpenChange={setShowSource} title="Source details"><div className="detail-group"><h3 className="group-label">Workbook</h3><dl className="key-value"><dt>File</dt><dd>{data.source.filename}</dd><dt>Period</dt><dd>{data.source.period}</dd><dt>Snapshot</dt><dd>Business day {data.source.asOfBD}</dd></dl></div>{selected && selectedStep && <div className="detail-group divider"><h3 className="group-label">Selected step</h3><dl className="key-value"><dt>Property</dt><dd>{selected.name}</dd><dt>Close step</dt><dd>{selectedStep.name}</dd><dt>Source</dt><dd className="mono">{selectedStep.source.sheet} · row {selectedStep.source.row}</dd><dt>Reported status</dt><dd>{selectedStep.status}</dd></dl></div>}{data.source.warnings.length > 0 && <div className="divider stack"><h3 className="group-label">Source notices</h3>{data.source.warnings.map((warning, i) => <Notice key={i} tone="warning">{warning}</Notice>)}</div>}</Dialog>
  </>;
}
