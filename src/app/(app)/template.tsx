"use client";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ease } from "@/components/motion";
// Remounts on each route change while the layout (header) stays put.
export default function Template({ children }: { children: ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease }}>{children}</motion.div>;
}
