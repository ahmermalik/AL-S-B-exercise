import { NextResponse } from "next/server";
import { actor, errorResponse, HttpError, mutationGeneration } from "@/server/http";
import { applyCaseAction, getCase, saveAgentProposal, recordAgentActivity } from "@/server/store";
import { reviseCaseWithAi } from "@/server/llm";
import type { CaseAction, Role } from "@/shared/types";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await actor(request);
    const body = await request.json() as CaseAction;
    mutationGeneration(request);
    if (!body || !Number.isInteger(body.expectedRevision)) throw new HttpError(400, "A current case version is required.");
    const id = (await context.params).id;
    const permissions: Record<CaseAction["action"], Role[]> = {
      request: ["manager", "accountant"], support: ["accountant"], prepare: ["manager", "accountant"], "revise-ai": ["manager", "accountant"],
      edit: ["manager"], approve: ["manager"], return: ["manager"], dismiss: ["manager"], execute: ["accountant"], verify: ["manager", "accountant"], resolve: ["manager"],
    };
    if (!permissions[body.action]?.includes(user.role)) throw new HttpError(403, "Your account cannot perform this action.");
    if (body.action === "revise-ai") {
      const current = getCase(id); if (!current) throw new HttpError(404, "Case not found.");
      if (current.revision !== body.expectedRevision) throw new HttpError(409, "This case changed. Reload before revising.");
      if (!["candidate", "awaiting_evidence", "ready"].includes(current.status)) throw new HttpError(409, "This case is no longer awaiting analysis. Add new evidence before revising it.");
      const generation = request.headers.get("X-Workspace-Generation")!;
      const proposal = await reviseCaseWithAi(current, { signal: request.signal, onActivity: record => recordAgentActivity({ ...record, caseId: id, importId: current.importId, resetGeneration: generation, actorId: user.id }) });
      return NextResponse.json(saveAgentProposal(id, body.expectedRevision, proposal));
    }
    return NextResponse.json(applyCaseAction(id, body, user));
  } catch (error) { return errorResponse(error); }
}
