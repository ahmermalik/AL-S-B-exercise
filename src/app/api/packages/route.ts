import { NextResponse } from "next/server";
import { actor, errorResponse, HttpError, workspaceHeaders, mutationGeneration } from "@/server/http";
import { getPackageDraft, savePackage } from "@/server/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { await actor(request); const propertyId = new URL(request.url).searchParams.get("propertyId") || "P105"; return NextResponse.json(getPackageDraft(propertyId), { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const user = await actor(request, ["manager"]); const body = await request.json();
    mutationGeneration(request);
    if (typeof body.propertyId !== "string" || typeof body.fingerprint !== "string" || body.acknowledged !== true || !(body.summary === null || typeof body.summary === "string" && body.summary.length <= 4000)) throw new HttpError(400, "Review the scope and open items before saving.");
    return NextResponse.json(savePackage(body, user));
  } catch (error) { return errorResponse(error); }
}
