"use client";
import { useCallback, useEffect, useState } from "react";
import { ensureWorkspaceGeneration, rememberWorkspaceGeneration } from "./workspace-reset";
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const resetGeneration = mutation ? await ensureWorkspaceGeneration() : null;
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (resetGeneration) headers.set("X-Workspace-Generation", resetGeneration);
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  const currentGeneration = response.headers.get("X-Workspace-Generation");
  if (currentGeneration) rememberWorkspaceGeneration(currentGeneration);
  if (!response.ok) {
    let message = "The request could not be completed.";
    try { const result = await response.json(); message = result.error || message; } catch { /* server returned no JSON */ }
    throw new ApiError(message, response.status);
  }
  const data: T = await response.json();
  if (data && typeof data === "object" && "resetGeneration" in data && typeof data.resetGeneration === "string") {
    rememberWorkspaceGeneration(data.resetGeneration);
  }
  return data;
}
export function useResource<T>(url: string) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ url: string; data: T | null; error: string | null; status: number | null }>({ url, data: null, error: null, status: null });
  useEffect(() => {
    const controller = new AbortController();
    api<T>(url, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setState({ url, data, error: null, status: null }); }).catch(error => { if (!controller.signal.aborted) setState(previous => ({ url, data: previous.url === url ? previous.data : null, error: error.message, status: error instanceof ApiError ? error.status : 0 })); });
    return () => controller.abort();
  }, [url, version]);
  return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null, status: state.url === url ? state.status : null, refresh: useCallback(() => setVersion(value => value + 1), []), replace: useCallback((data: T) => setState({ url, data, error: null, status: null }), [url]) };
}

