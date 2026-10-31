import { NextResponse } from "next/server";
import { actor, errorResponse, HttpError, workspaceHeaders, mutationGeneration } from "@/server/http";
import { getWorkspace, getRun, importWorkbook, createRun, cancelRun, resumeRun } from "@/server/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { await actor(request); const workspace = getWorkspace(); return NextResponse.json({ source: workspace.source, run: workspace.run }, { headers: workspaceHeaders() }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await actor(request);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (["queued", "running"].includes(getWorkspace().run?.status || "")) throw new HttpError(409, "Cancel or finish the current preparation before replacing its source.");
      const form = await request.formData(); const file = form.get("file");
      const expectedGeneration = mutationGeneration(request);
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new HttpError(400, "Select an Excel .xlsx workbook.");
      if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "The workbook must be smaller than 10 MB.");
      return NextResponse.json(await importWorkbook(Buffer.from(await file.arrayBuffer()), file.name, { expectedGeneration }));
    }
    const body = await request.json();
    mutationGeneration(request);
    if (body.action === "start") {
      const source = getWorkspace().source;
      if (!source) throw new HttpError(400, "Import a workbook first.");
      if (body.importId !== source.id) throw new HttpError(409, "The source workbook changed. Reload preparation before starting.");
      return NextResponse.json(createRun(source.id));
    }
    if (typeof body.runId !== "string") throw new HttpError(400, "Select a preparation run.");
    if (getRun(body.runId)?.importId !== getWorkspace().source?.id) throw new HttpError(409, "This run belongs to a different source. Reload preparation before continuing.");
    if (body.action === "cancel") return NextResponse.json(cancelRun(body.runId));
    if (body.action === "resume") return NextResponse.json(resumeRun(body.runId));
    throw new HttpError(400, "Unknown preparation action.");
  } catch (error) { return errorResponse(error); }
}
