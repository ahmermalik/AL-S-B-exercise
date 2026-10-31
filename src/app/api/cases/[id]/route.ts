import { NextResponse } from "next/server";
import { actor, errorResponse, HttpError, workspaceHeaders } from "@/server/http";
import { getCase } from "@/server/store";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await actor(request); const value = getCase((await context.params).id); if (!value) throw new HttpError(404, "Case not found."); return NextResponse.json(value, { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
