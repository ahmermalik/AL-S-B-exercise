import { NextResponse } from "next/server";
import { actor, errorResponse, workspaceHeaders } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { return NextResponse.json({ user: await actor(request) }, { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
