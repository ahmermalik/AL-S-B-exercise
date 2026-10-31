"use client";

import * as Popover from "@radix-ui/react-popover";
import { LogOut, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { clearWorkflowStorage, rememberWorkspaceGeneration } from "@/lib/workspace-reset";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Notice } from "./common";
import type { User } from "./shell";

export function AccountMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resetError, setResetError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  const openingConfirmation = useRef(false);
  const role = user.role === "manager" ? "Accounting manager" : "Staff accountant";
  const initials = user.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("");

  function focusMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }

  function confirmReset() {
    openingConfirmation.current = true;
    trigger.current?.focus();
    setResetError("");
    setOpen(false);
    setConfirming(true);
  }

  async function reset() {
    if (resetting) return;
    setResetting(true);
    setResetError("");
    try {
      const result = await api<{ resetGeneration: string; reloadedSource: boolean }>("/api/reset", { method: "POST", body: JSON.stringify({ confirmed: true }) });
      clearWorkflowStorage();
      rememberWorkspaceGeneration(result.resetGeneration);
      // A full navigation discards all in-memory drafts from the previous workspace.
      window.location.replace(new URL("/", window.location.origin).href);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "The walkthrough could not be reset. Try again.");
      setResetting(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Sign out failed. Try again.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Sign out failed. Try again.");
      setSigningOut(false);
    }
  }

  return <>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild><button ref={trigger} type="button" className="account-trigger" aria-label={`${user.name}, account menu`} aria-haspopup="menu" title="Account menu" onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          focusLast.current = event.key === "ArrowUp";
          setOpen(true);
        }
      }}><span className="account-avatar" aria-hidden="true">{initials}</span><span className="account-label"><span>{user.name}</span><small>{role}</small></span></button></Popover.Trigger>
      <Popover.Portal><Popover.Content ref={menu} role="menu" aria-label="Account menu" className="account-menu" align="end" sideOffset={12} collisionPadding={16} onKeyDown={focusMenu} onOpenAutoFocus={event => {
        event.preventDefault();
        const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        items?.[focusLast.current ? items.length - 1 : 0]?.focus();
        focusLast.current = false;
      }} onCloseAutoFocus={event => {
        if (openingConfirmation.current) { event.preventDefault(); openingConfirmation.current = false; }
      }}>
        <div className="account-menu-identity"><strong>{user.name}</strong><span>{user.email}</span><small>{role}</small></div>
        <div className="account-menu-actions"><button type="button" role="menuitem" onClick={confirmReset}><RotateCcw size={16} aria-hidden="true" />Reset walkthrough</button><button type="button" role="menuitem" disabled={signingOut} onClick={signOut}><LogOut size={16} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button></div>
        {signOutError && <p className="account-menu-error" role="alert">{signOutError}</p>}
      </Popover.Content></Popover.Portal>
    </Popover.Root>
    <Dialog open={confirming} onOpenChange={next => { if (!resetting) setConfirming(next); }} title="Reset walkthrough?">
      <p>Clear all preparation runs, cases, added support, review decisions and packages for both accounts, then restore the original workbook.</p>
      <p className="muted small section-gap">Both logins and your appearance setting will stay. This cannot be undone.</p>
      {resetError && <div className="section-gap"><Notice>{resetError}</Notice></div>}
      <div className="actions account-reset-actions"><Button variant="outline" disabled={resetting} onClick={() => setConfirming(false)}>Cancel</Button><Button variant="danger" loading={resetting} onClick={reset}>{resetting ? "Resetting…" : "Reset walkthrough"}</Button></div>
    </Dialog>
  </>;
}
