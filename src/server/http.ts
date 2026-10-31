import { NextResponse } from "next/server";
import { auth } from "./auth";
import type { Role } from "@/shared/types";
import { assertResetGeneration, getResetGeneration } from "./store";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function mutationGeneration(request: Request): string {
  const generation = request.headers.get("X-Workspace-Generation");
  if (!generation) throw new HttpError(409, "Reload the application before continuing; its workspace version is required.");
  assertResetGeneration(generation);
  return generation;
}
export async function actor(request: Request, roles?: Role[]): Promise<{ id: string; name: string; email: string; role: Role }> {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const allowed = new Set([new URL(request.url).origin, process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000"]);
    if (!origin || !allowed.has(origin)) throw new HttpError(403, "This request must come from the application.");
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "Sign in to continue.");
  const role = session.user.role;
  if (role !== "manager" && role !== "accountant") throw new HttpError(403, "This account has no review access.");
  if (roles && !roles.includes(role)) throw new HttpError(403, "Your account cannot perform this action.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    mutationGeneration(request);
  }
  return { id: session.user.id, name: session.user.name, email: session.user.email, role };
}
export function errorResponse(error: unknown) {
  const status = error instanceof SyntaxError ? 400 : error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  if (status >= 500 && status !== 503) console.error("Request failed", error);
  return NextResponse.json({ error: status === 500 ? "The request could not be completed. Try again." : message }, { status, headers: { "X-Workspace-Generation": getResetGeneration() } });
}
export const noStore = { "Cache-Control": "private, no-store" };
export function workspaceHeaders() { return { ...noStore, "X-Workspace-Generation": getResetGeneration() }; }
