"use client";
import { useEffect, useState, type ReactNode } from "react";
import { animate, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform, type Transition, type Variants } from "framer-motion";
import { ReactLenis } from "lenis/react";

// Shared easing so every animation in the app feels like one system.
export const ease = [0.22, 1, 0.36, 1] as const;
export const spring: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.7 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};
export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

// Smooth scrolling plus app-wide motion settings. Both respect the OS reduced-motion setting.
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const content = <MotionConfig reducedMotion="user" transition={{ duration: 0.4, ease }}>{children}</MotionConfig>;
  if (reduced) return content;
  return <ReactLenis root options={{ lerp: 0.16, smoothWheel: true, anchors: { offset: -88 }, allowNestedScroll: true }}>{content}</ReactLenis>;
}

// Counts up once per session for a given label; afterwards it shows the value directly and only tweens real changes.
const counted = new Set<string>();
export function CountUp({ value, id }: { value: number; id?: string }) {
  const [skip] = useState(() => !!id && counted.has(id));
  const count = useMotionValue(skip ? value : 0);
  const rounded = useTransform(count, latest => Math.round(latest).toLocaleString());
  const reduced = useReducedMotion();
  useEffect(() => {
    if (id) counted.add(id);
    if (reduced) { count.set(value); return; }
    const controls = animate(count, value, { duration: 0.6, ease });
    return () => controls.stop();
  }, [count, value, reduced, id]);
  return <motion.span>{rounded}</motion.span>;
}
