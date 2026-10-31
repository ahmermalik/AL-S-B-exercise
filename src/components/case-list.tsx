"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CaseSummary } from "@/shared/types";
import { money } from "@/lib/ui";
import { Empty, Status } from "./common";
export function CaseList({ cases }: { cases: CaseSummary[] }) {
  if (!cases.length) return <Empty title="No findings prepared"><p>Run preparation to review invoice and close exceptions.</p><Link href="/prepare">Prepare review</Link></Empty>;
  return <div className="case-list">{cases.map(item => <div key={item.id} className="case-list-item row-link"><div className="grow"><Link href={`/cases/${item.id}`} className="row-title"><h3>{item.title}</h3></Link><div className="small muted">{item.kind === "close" ? item.nextAction : money(item.amountCents)} · {item.owner}</div></div><Status value={item.status} /><ArrowUpRight size={17} className="row-arrow" aria-hidden="true" /></div>)}</div>;
}

