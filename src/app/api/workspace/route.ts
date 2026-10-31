import { NextResponse } from "next/server";
import { actor, errorResponse, workspaceHeaders } from "@/server/http";
import { getWorkspace } from "@/server/store";
import { isAiConfigured } from "@/server/llm";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { await actor(request); return NextResponse.json({ ...getWorkspace(), ai: { configured: isAiConfigured(), model: process.env.OPENAI_MODEL || null } }, { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
