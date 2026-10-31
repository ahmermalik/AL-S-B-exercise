import { actor, errorResponse, HttpError, noStore } from "@/server/http";
import { getPackage } from "@/server/store";
import { packageCsv, packageHtml } from "@/server/reports";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await actor(request); const snapshot = getPackage((await context.params).id);
    if (!snapshot) throw new HttpError(404, "Package not found.");
    if (new URL(request.url).searchParams.get("format") === "csv") return new Response(packageCsv(snapshot), { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${snapshot.propertyId}-review-v${snapshot.version}.csv"` } });
    return new Response(packageHtml(snapshot), { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'" } });
  } catch (error) { return errorResponse(error); }
}
