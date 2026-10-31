import { NextResponse } from "next/server";
import { actor, errorResponse, HttpError, noStore, mutationGeneration } from "@/server/http";
import { getResetGeneration, resetWorkspace } from "@/server/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await actor(request);
    return NextResponse.json({ resetGeneration: getResetGeneration() }, { headers: noStore });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await actor(request);
    const body: unknown = await request.json();
    const expectedGeneration = mutationGeneration(request);
    if (!body || typeof body !== "object" || !("confirmed" in body) || body.confirmed !== true) {
      throw new HttpError(400, "Confirm that all walkthrough work should be cleared.");
    }
    const result = await resetWorkspace({ reloadSource: true, expectedGeneration });
    return NextResponse.json(result, { headers: { ...noStore, "X-Workspace-Generation": result.resetGeneration } });
  } catch (error) { return errorResponse(error); }
}
