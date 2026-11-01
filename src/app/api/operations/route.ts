import { NextResponse } from "next/server";
import { actor, errorResponse, workspaceHeaders } from "@/server/http";
import { getOperations } from "@/server/briefing";
export const runtime = "nodejs";
// Comparative accountant information is limited to accounting managers.
export async function GET(request: Request) {
  try { await actor(request, ["manager"]); return NextResponse.json(getOperations(), { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
