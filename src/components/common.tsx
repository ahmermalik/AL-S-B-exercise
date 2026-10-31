"use client";
import { AlertCircle, ArrowLeft, CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ease, spring } from "./motion";
import { statusLabel } from "@/lib/ui";
import { Button } from "./ui/button";
// Badges render still on first paint and only animate when their value changes, so lists don't all pop at once.
export function Status({ value, label }: { value: string; label?: string }) {
  const [initialValue] = useState(value);
  const changed = value !== initialValue;
  return <motion.span key={value} className={`status status-${value}`} initial={changed ? { scale: 0.85, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={spring}>{label || statusLabel(value)}</motion.span>;
}
const noticeIcon: Record<string, LucideIcon> = { error: AlertCircle, warning: TriangleAlert, success: CheckCircle2 };
export function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "warning" | "success" }) {
  const Icon = noticeIcon[tone];
  return <motion.div role={tone === "error" ? "alert" : "status"} className={`notice notice-${tone}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}><Icon size={16} /><div>{children}</div></motion.div>;
}
export function Loading({ text = "Loading workspace" }: { text?: string }) { return <motion.div className="loading" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }}><LoaderCircle className="spin" size={19} />{text}</motion.div>; }
export function ErrorState({ error, retry }: { error: string; retry?: () => void }) { return <div className="error-state"><Notice>{error}</Notice>{retry && <Button variant="outline" onClick={retry}><RefreshCw size={15} />Try again</Button>}</div>; }
export function Empty({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children?: ReactNode }) { return <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease }}>{Icon && <span className="empty-icon"><Icon size={20} /></span>}<h2>{title}</h2>{children}</motion.div>; }
export function BackLink({ href = "/", children = "Workspace" }: { href?: string; children?: ReactNode }) { return <Link href={href} className="back-link"><ArrowLeft size={14} />{children}</Link>; }
