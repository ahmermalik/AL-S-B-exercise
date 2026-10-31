"use client";

const generationKey = "close-workspace-generation";
const resetEvent = "close-workspace-reset";
let generation: string | null = null;
let pendingGeneration: Promise<string> | null = null;

export function clearWorkflowStorage(): void {
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      for (const key of Object.keys(storage)) if (key.startsWith("close-summary:")) storage.removeItem(key);
    } catch { /* Saved server records remain authoritative when browser storage is unavailable. */ }
  }
}

export function rememberWorkspaceGeneration(next: string): boolean {
  if (!next || typeof window === "undefined") return false;
  if (generation === null) {
    try { generation = localStorage.getItem(generationKey); } catch { /* Use memory for this page. */ }
  }
  const changed = generation !== null && generation !== next;
  if (changed) clearWorkflowStorage();
  generation = next;
  try { localStorage.setItem(generationKey, next); } catch { /* Polling also covers separate browser profiles. */ }
  if (changed) window.dispatchEvent(new CustomEvent(resetEvent));
  return changed;
}

export async function ensureWorkspaceGeneration(): Promise<string> {
  if (generation) return generation;
  if (!pendingGeneration) {
    pendingGeneration = fetch("/api/reset", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Reload the application before continuing.");
      const data = await response.json() as { resetGeneration?: unknown };
      if (typeof data.resetGeneration !== "string" || !data.resetGeneration) throw new Error("Reload the application before continuing.");
      rememberWorkspaceGeneration(data.resetGeneration);
      return data.resetGeneration;
    }).finally(() => { pendingGeneration = null; });
  }
  return pendingGeneration;
}

export function installWorkspaceResetObserver(onReset: () => void): () => void {
  let stopped = false;
  let checking = false;
  const controller = new AbortController();
  const notify = () => { if (!stopped) onReset(); };
  async function check() {
    if (stopped || checking) return;
    checking = true;
    try {
      const response = await fetch("/api/reset", { cache: "no-store", signal: controller.signal });
      if (!response.ok || stopped) return;
      const data = await response.json() as { resetGeneration?: unknown };
      if (!stopped && typeof data.resetGeneration === "string") rememberWorkspaceGeneration(data.resetGeneration);
    } catch { /* Keep the current view usable during a temporary connection failure. */ }
    finally { checking = false; }
  }
  const storageChanged = (event: StorageEvent) => {
    if (event.key === generationKey && event.newValue) rememberWorkspaceGeneration(event.newValue);
  };
  window.addEventListener(resetEvent, notify);
  window.addEventListener("storage", storageChanged);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  const timer = window.setInterval(check, 5000);
  void check();
  return () => {
    stopped = true; controller.abort(); window.clearInterval(timer);
    window.removeEventListener(resetEvent, notify);
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", check);
  };
}
