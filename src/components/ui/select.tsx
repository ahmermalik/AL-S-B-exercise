"use client";
import { useId, useState, type ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui";
import { ease, spring } from "../motion";
export type SelectOption = { value: string; label: ReactNode; hint?: ReactNode; count?: number; disabled?: boolean };
// Radix reserves "" for "no selection", so an empty option value is mapped to a sentinel internally.
const EMPTY = "__empty__";
const toInner = (v: string) => v === "" ? EMPTY : v;
const toOuter = (v: string) => v === EMPTY ? "" : v;
// Accessible custom dropdown (keyboard, typeahead, screen readers via Radix) with a branded animated menu.
export function Select({ value, onValueChange, options, placeholder, size = "md", disabled, className, id, ...aria }: {
  value: string; onValueChange: (value: string) => void; options: SelectOption[]; placeholder?: string; size?: "sm" | "md"; disabled?: boolean; className?: string; id?: string;
  "aria-label"?: string; "aria-labelledby"?: string;
}) {
  const [open, setOpen] = useState(false); const [highlighted, setHighlighted] = useState<string | null>(null);
  const layoutId = useId();
  // The menu mounts only while open, so the trigger renders the selected label itself.
  const selected = options.find(o => o.value === value);
  return <SelectPrimitive.Root value={toInner(value)} onValueChange={v => onValueChange(toOuter(v))} open={open} onOpenChange={next => { setOpen(next); if (!next) setHighlighted(null); }} disabled={disabled}>
    <SelectPrimitive.Trigger id={id} className={cn("select-trigger", size === "sm" && "select-trigger--sm", className)} {...aria}>
      <SelectPrimitive.Value placeholder={placeholder}>{selected?.label}</SelectPrimitive.Value>
      <SelectPrimitive.Icon asChild><motion.span className="select-chevron" animate={{ rotate: open ? 180 : 0 }} transition={spring}><ChevronDown size={16} /></motion.span></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <AnimatePresence>{open && <SelectPrimitive.Portal forceMount>
      <SelectPrimitive.Content forceMount position="popper" side="bottom" align="start" sideOffset={6} collisionPadding={12} asChild>
        <motion.div className="select-content" data-lenis-prevent initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: spring }} exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease } }}>
          <SelectPrimitive.Viewport className="select-viewport" onPointerLeave={() => setHighlighted(null)}>
            {options.map((option, index) => <SelectPrimitive.Item key={toInner(option.value)} value={toInner(option.value)} disabled={option.disabled} className="select-item" onFocus={() => setHighlighted(toInner(option.value))} asChild>
              <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 8) * 0.018, duration: 0.18, ease }}>
                {highlighted === toInner(option.value) && <motion.span layoutId={`select-hl-${layoutId}`} className="select-highlight" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                <span className="select-item-body"><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>{option.hint && <span className="select-hint">{option.hint}</span>}</span>
                {option.count !== undefined && <span className="select-count">{option.count}</span>}
                <SelectPrimitive.ItemIndicator asChild><motion.span className="select-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}><Check size={15} /></motion.span></SelectPrimitive.ItemIndicator>
              </motion.div>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
        </motion.div>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>}</AnimatePresence>
  </SelectPrimitive.Root>;
}
