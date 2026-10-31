"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/ui";
import { spring } from "../motion";
const variants = cva("button", { variants: { variant: { default: "button-primary", outline: "button-outline", ghost: "button-ghost", danger: "button-danger" }, size: { default: "", sm: "button-small", icon: "button-icon" } }, defaultVariants: { variant: "default", size: "default" } });
const MotionSlot = motion.create(Slot);
// `loading` keeps the label in place, adds a spinner and marks the button busy. Only a subtle press is animated.
export function Button({ asChild = false, loading = false, variant, size, className, type = "button", disabled, children, ...props }: React.ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean; loading?: boolean }) {
  const Component = asChild ? MotionSlot : motion.button;
  const inactive = disabled || loading;
  return <Component type={type} className={cn(variants({ variant, size }), className)} disabled={asChild ? undefined : inactive} aria-busy={loading || undefined} transition={spring} {...(inactive ? {} : { whileTap: { scale: 0.98 } })} {...(props as HTMLMotionProps<"button">)}>
    {asChild ? children : <>{loading && <LoaderCircle size={15} className="spin" aria-hidden="true" />}{children}</>}
  </Component>;
}
