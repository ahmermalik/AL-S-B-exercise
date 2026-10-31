"use client";
import { motion } from "framer-motion";
// Layout-matched placeholders keep geometry stable while data loads. They fade in after a short delay so fast loads don't flicker.
export function Skeleton({ w = "100%", h = 14, className = "" }: { w?: number | string; h?: number | string; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h }} aria-hidden="true" />;
}
function Panel({ rows = 5, head = true }: { rows?: number; head?: boolean }) {
  return <div className="panel">{head && <div className="panel-head"><Skeleton w={180} h={20} /></div>}<div className="panel-body skeleton-stack">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} w={`${92 - (i % 3) * 14}%`} />)}</div></div>;
}
export function PageSkeleton({ variant, label = "Loading" }: { variant: "table" | "workspace" | "three" | "two"; label?: string }) {
  return <motion.div role="status" aria-label={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.3 }}>
    <div className="page-head"><div className="skeleton-stack"><Skeleton w={160} h={12} /><Skeleton w={320} h={34} /></div></div>
    {variant === "workspace" && <div className="stat-strip"><div className="stat-group">{[0, 1, 2, 3].map(i => <div key={i} className="stat skeleton-stack"><Skeleton w={56} h={30} /><Skeleton w={110} h={12} /></div>)}</div></div>}
    {(variant === "table" || variant === "workspace") && <div className="panel"><div className="panel-head"><Skeleton w={220} h={20} /></div>{Array.from({ length: 7 }, (_, i) => <div key={i} className="skeleton-row"><Skeleton w="22%" /><Skeleton w="48%" /><Skeleton w="14%" /></div>)}</div>}
    {variant === "three" && <div className="three-column"><Panel rows={6} /><Panel rows={9} /><Panel rows={5} /></div>}
    {variant === "two" && <div className="two-column"><Panel rows={6} /><Panel rows={8} /></div>}
  </motion.div>;
}
