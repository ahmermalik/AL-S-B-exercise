import { NextResponse } from "next/server";
import { actor, errorResponse, mutationGeneration, workspaceHeaders } from "@/server/http";
import { ensureBriefing } from "@/server/briefing";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await actor(request, ["manager"]);
    const briefing = await ensureBriefing({ actorId: user.id, generation: mutationGeneration(request) });
    return NextResponse.json({ briefing }, { headers: workspaceHeaders() });
  } catch (error) { return errorResponse(error); }
}
