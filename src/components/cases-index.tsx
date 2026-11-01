"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { motion } from "framer-motion";
import type { CaseSummary, Workspace } from "@/shared/types";
import { useResource } from "@/lib/api";
import { money } from "@/lib/ui";
import { Button } from "./ui/button";
import { Empty, ErrorState, Status } from "./common";
import { PageSkeleton } from "./skeleton";
import { fadeUp, spring } from "./motion";
const kindLabel: Record<CaseSummary["kind"], string> = { duplicate: "Duplicate invoice", coding: "GL coding", variance: "Variance commentary", approval: "Approval evidence", close: "Close blocker" };
const closed = (item: CaseSummary) => item.status === "resolved" || item.status === "dismissed";
// Cases that need someone to act come first, then by amount.
const attention: Record<string, number> = { awaiting_evidence: 0, candidate: 1, ready: 2, verification_failed: 3, approved: 4, executed: 5, verified: 6, resolved: 7, dismissed: 8 };
const tabs = [{ id: "open", label: "Open" }, { id: "closed", label: "Resolved & dismissed" }, { id: "all", label: "All" }] as const;
export function CasesScreen({ kind: initialKind, property: initialProperty }: { kind?: string; property?: string } = {}) {
  const { data, error, refresh } = useResource<Workspace>("/api/workspace");
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("open");
  const [kind, setKind] = useState<CaseSummary["kind"] | null>(initialKind && initialKind in kindLabel ? initialKind as CaseSummary["kind"] : null);
  const [property, setProperty] = useState<string | null>(initialProperty || null);
  function clearFilter(next: { kind: CaseSummary["kind"] | null; property: string | null }) {
    setKind(next.kind); setProperty(next.property);
    const params = new URLSearchParams();
    if (next.kind) params.set("kind", next.kind);
    if (next.property) params.set("property", next.property);
    window.history.replaceState(null, "", params.size ? `/cases?${params}` : "/cases");
  }
  const scoped = useMemo(() => (data?.cases || []).filter(item => (!kind || item.kind === kind) && (!property || item.propertyId === property)), [data, kind, property]);
  const cases = useMemo(() => scoped.filter(item => tab === "all" || (tab === "open" ? !closed(item) : closed(item))).sort((a, b) => (attention[a.status] ?? 9) - (attention[b.status] ?? 9) || b.amountCents - a.amountCents), [scoped, tab]);
  const counts = { open: scoped.filter(c => !closed(c)).length, closed: scoped.filter(closed).length, all: scoped.length };
  if (error && !data) return <ErrorState error={error} retry={refresh} />;
  if (!data) return <PageSkeleton variant="table" />;
  const exposure = (scoped.filter(c => !closed(c) && c.kind !== "close" && c.kind !== "variance")).reduce((sum, c) => sum + c.amountCents, 0);
  const propertyName = property ? data.properties.find(p => p.id === property)?.name || property : null;
  return <>
    <motion.header className="page-head" variants={fadeUp} initial="hidden" animate="show"><div><div className="eyebrow">{data.source?.period || "Month-end close"}</div><h1>Case review</h1><p>{counts.open} open findings{exposure ? ` · ${money(exposure)} in invoice exposure` : ""}</p></div></motion.header>
    <section className="panel">
      <div className="panel-head"><div className="segmented" role="tablist" aria-label="Case filter">{tabs.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>{tab === t.id && <motion.span layoutId="cases-tab" className="segmented-thumb" transition={spring} />}<span>{t.label}</span><span className="segmented-count">{counts[t.id]}</span></button>)}</div>{(kind || property) && <div className="filter-chips">{kind && <button type="button" className="filter-chip" aria-label={`Remove ${kindLabel[kind]} filter`} onClick={() => clearFilter({ kind: null, property })}>{kindLabel[kind]}<X size={12} aria-hidden="true" /></button>}{propertyName && <button type="button" className="filter-chip" aria-label={`Remove ${propertyName} filter`} onClick={() => clearFilter({ kind, property: null })}>{propertyName}<X size={12} aria-hidden="true" /></button>}</div>}</div>
      {cases.length ? <div className="table-wrap"><table className="data-table cases-table"><thead><tr><th>Finding</th><th>Property</th><th className="text-right">Amount</th><th>Status</th><th>Next action</th><th aria-label="Open" /></tr></thead>
        <motion.tbody key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>{cases.map(item => <tr key={item.id} className="row-link">
          <td><Link href={`/cases/${item.id}`} className="row-title">{item.title}</Link><span className="sub">{kindLabel[item.kind]}</span></td>
          <td><span className="mobile-cell-label">Property</span>{item.propertyName}<span className="sub">{item.propertyId}</span></td>
          <td className="text-right mono"><span className="mobile-cell-label">Amount</span>{item.kind === "close" && !item.amountCents ? "—" : money(item.amountCents)}</td>
          <td><span className="mobile-cell-label">Status</span><Status value={item.status} /></td>
          <td><span className="mobile-cell-label">Next action</span>{item.nextAction}<span className="sub">{item.owner}</span></td>
          <td className="text-right"><ArrowUpRight size={16} className="row-arrow" aria-hidden="true" /></td>
        </tr>)}</motion.tbody></table></div>
        : <Empty title={tab === "open" ? "No open findings" : "Nothing here yet"}>{data.cases.length ? <p className="muted">Switch tabs to see other findings.</p> : <Button asChild><Link href="/prepare">Prepare review<ArrowRight size={16} /></Link></Button>}</Empty>}
    </section>
  </>;
}
