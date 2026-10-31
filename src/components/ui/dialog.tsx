"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useId, useRef, useState, type ReactNode } from "react";
import { ease, spring } from "../motion";
export function Dialog({ open, onOpenChange, title, description, children, wide = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const descriptionId = useId();
  const opener = useRef<HTMLElement | null>(null);
  // Keep the last open content so the dialog doesn't empty out while its exit animation plays.
  const [kept, setKept] = useState({ title, children });
  if (open && (kept.title !== title || kept.children !== children)) setKept({ title, children });
  const shown = open ? { title, children } : kept;
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><AnimatePresence>{open && <DialogPrimitive.Portal forceMount>
    <DialogPrimitive.Overlay asChild forceMount><motion.div className="dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }} /></DialogPrimitive.Overlay>
    <DialogPrimitive.Content asChild forceMount aria-describedby={description ? descriptionId : undefined} onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }}>
      <motion.div data-lenis-prevent className={`dialog-content ${wide ? "dialog-wide" : ""}`} initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: spring }} exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18, ease } }}>
        <header className="dialog-header"><div><DialogPrimitive.Title className="dialog-title">{shown.title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description id={descriptionId} className="muted small">{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close className="button button-ghost button-icon" aria-label="Close"><X size={18} /></DialogPrimitive.Close></header>
        <motion.div className="dialog-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35, ease }}>{shown.children}</motion.div>
      </motion.div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>}</AnimatePresence></DialogPrimitive.Root>;
}
