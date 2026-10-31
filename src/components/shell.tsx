"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, Files, ClipboardCheck, Sun, Moon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "./motion";
import type { Role } from "@/shared/types";
import { Button } from "./ui/button";
import { installWorkspaceResetObserver } from "@/lib/workspace-reset";
import { LaunchIntro } from "./launch-intro";
import { AccountMenu } from "./account-menu";
export type User = { id: string; name: string; email: string; role: Role };
const UserContext = createContext<User | null>(null);
const navItems = [
  { href: "/", label: "Workspace", short: "Workspace", Icon: LayoutDashboard, active: (p: string) => p === "/" },
  { href: "/prepare", label: "Prepare review", short: "Prepare", Icon: ListChecks, active: (p: string) => p === "/prepare" },
  { href: "/cases", label: "Case review", short: "Cases", Icon: Files, active: (p: string) => p.startsWith("/cases") },
  { href: "/packages", label: "Review package", short: "Package", Icon: ClipboardCheck, active: (p: string) => p === "/packages" },
];
export function useUser() { return useContext(UserContext); }
function readAppearance(): "light" | "dark" {
  // The head script normally applies the saved choice before paint; this is the fallback.
  let saved: string | null = null;
  try { saved = localStorage.getItem("close-appearance"); } catch { /* System appearance remains available. */ }
  if ((saved === "light" || saved === "dark") && document.documentElement.dataset.appearance !== saved) { document.documentElement.dataset.appearance = saved; document.documentElement.style.colorScheme = saved; }
  const set = document.documentElement.dataset.appearance;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function AppearanceButton() {
  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setAppearance(readAppearance());
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  function toggle() {
    const next = appearance === "dark" ? "light" : "dark";
    const apply = () => { document.documentElement.style.colorScheme = next; document.documentElement.dataset.appearance = next; setAppearance(next); };
    // Crossfade the theme change where the browser supports view transitions.
    const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply); else apply();
    try { localStorage.setItem("close-appearance", next); } catch { /* The current view still changes. */ }
  }
  const label = appearance === "dark" ? "Use light appearance" : "Use dark appearance";
  return <Button size="icon" variant="ghost" aria-label={label} title={label} onClick={toggle}><AnimatePresence mode="wait" initial={false}><motion.span key={appearance} className="icon-swap" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>{appearance === "dark" ? <Sun size={18} /> : <Moon size={18} />}</motion.span></AnimatePresence></Button>;
}
export function Shell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => installWorkspaceResetObserver(() => {
    // Reset must discard component drafts as well as the Next.js route cache.
    window.location.replace(new URL("/", window.location.origin).href);
  }), []);
  return <UserContext.Provider value={user}><LaunchIntro><div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <Link href="/" className="brand" aria-label="Asset Living Close review"><Image className="brand-logo" src="/brand/asset-living-white.svg" width={191} height={40} alt="Asset Living" priority /><span className="brand-subtitle">Close review</span></Link>
      <nav className="main-nav" aria-label="Main navigation" onMouseLeave={() => setHovered(null)} onBlur={() => setHovered(null)}>{navItems.map(({ href, label, short, Icon, active }) => {
        const current = active(pathname);
        return <Link key={href} className={current ? "active" : ""} href={href} aria-current={current ? "page" : undefined} onMouseEnter={() => setHovered(href)} onFocus={() => setHovered(href)}>
          <AnimatePresence>{hovered === href && !current && <motion.span layoutId="nav-hover" className="nav-hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} />}</AnimatePresence>
          {current && <motion.span layoutId="nav-active" className="nav-active" transition={spring} />}
          <Icon size={17} /><span className="nav-label" data-label={label}><span className="nav-long">{label}</span><span className="nav-short">{short}</span></span>
        </Link>;
      })}</nav>
      <div className="account"><AppearanceButton /><AccountMenu user={user} /></div>
    </header>
    <main className="app-main" id="main" tabIndex={-1}>{children}</main>
    <footer className="app-footer"><a href="https://www.linkedin.com/in/ahmermalikm/" target="_blank" rel="noopener noreferrer">Made by Ahmer Malik</a><span>Property accounting · Signed in as {user.role === "manager" ? "accounting manager" : "staff accountant"}</span></footer>
  </div></LaunchIntro></UserContext.Provider>;
}
