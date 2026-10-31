"use client";
import { useId } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ArrowRight, Check, Clock3, X } from "lucide-react";
import { motion } from "framer-motion";
import type { CloseStep, Property } from "@/shared/types";
import { describeCloseStep } from "@/lib/close-step";
import { spring } from "./motion";

export function CloseStepCell({ property, step, asOfBD, selected, onSelect, caseId }: {
  property: Pick<Property, "name" | "accountant">;
  step: CloseStep;
  asOfBD: number;
  selected: boolean;
  onSelect: () => void;
  caseId?: string;
}) {
  const titleId = useId(), descriptionId = useId();
  const detail = describeCloseStep(step, asOfBD);
  const needsAttention = detail.state === "late" || detail.state === "conflict";
  const symbol = detail.state === "conflict" ? "?" : detail.state === "complete" ? <Check size={14} /> : detail.state === "late" ? "!" : detail.state === "due" ? "○" : "–";
  return <Popover.Root>
    <Popover.Trigger asChild>
      <motion.button type="button" whileTap={{ scale: .96 }} transition={spring}
        aria-label={`${property.name}: ${step.name}, ${detail.label}; due business day ${step.dueBD}`}
        title={`${step.name} · ${detail.label} · due business day ${step.dueBD}`}
        className={`step-cell step-${detail.state} ${selected ? "step-selected" : ""}`} onClick={onSelect}>{symbol}</motion.button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="step-popover" sideOffset={10} collisionPadding={14} hideWhenDetached
        aria-labelledby={titleId} aria-describedby={descriptionId} data-lenis-prevent>
        <div className="step-popover-scroll">
        <div className="step-popover-heading"><div><p className="source-ref">{property.name}</p><h3 id={titleId}>{step.name}</h3></div><Popover.Close className="button button-ghost button-icon" aria-label="Close step details"><X size={16} /></Popover.Close></div>
        <span className="step-popover-state" data-state={detail.state}><Clock3 size={14} />{detail.label}</span>
        <p id={descriptionId} className="step-popover-description">{detail.description}</p>
        {(needsAttention || detail.state === "due") ? <div className="step-popover-next"><strong>Next step · {property.accountant}</strong><p>{detail.state === "conflict" ? "Verify the completion date against the workpaper and correct the tracker if needed." : "Provide the workpaper and confirm completion, or explain the blocker."}</p></div> : <div className="step-popover-owner"><span>Owner</span><strong>{property.accountant}</strong></div>}
        {needsAttention && caseId && <Link className="step-popover-link" href={`/cases/${caseId}`}>Review close blocker<ArrowRight size={14} /></Link>}
        </div>
        <Popover.Arrow className="step-popover-arrow" width={12} height={6} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
