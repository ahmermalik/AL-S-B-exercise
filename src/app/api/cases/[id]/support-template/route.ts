import { NextResponse } from "next/server";
import { actor, errorResponse, workspaceHeaders } from "@/server/http";
import { getSupportTemplate } from "@/server/store";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await actor(request, ["accountant"]); return NextResponse.json(getSupportTemplate((await context.params).id), { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
