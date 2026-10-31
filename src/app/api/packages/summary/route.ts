import { NextResponse } from "next/server";
import { actor, errorResponse, HttpError, mutationGeneration } from "@/server/http";
import { getPackageDraft, recordAgentActivity } from "@/server/store";
import { draftSummary } from "@/server/llm";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await actor(request, ["manager"]); const body = await request.json();
    mutationGeneration(request);
    if (typeof body.propertyId !== "string") throw new HttpError(400, "Select a property.");
    const draft = getPackageDraft(body.propertyId); const generation = request.headers.get("X-Workspace-Generation")!;
    const summary = await draftSummary(draft.cases, { signal: request.signal, onActivity: record => recordAgentActivity({ ...record, actorId: user.id, propertyId: body.propertyId, importId: draft.source.id, resetGeneration: generation, fingerprint: draft.fingerprint }) });
    if (getPackageDraft(body.propertyId).fingerprint !== draft.fingerprint) throw new HttpError(409, "Case evidence changed while the summary was being drafted. Try again.");
    return NextResponse.json({ summary, fingerprint: draft.fingerprint });
  } catch (error) { return errorResponse(error); }
}
