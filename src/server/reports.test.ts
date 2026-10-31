import { describe, it, expect } from "vitest";
import { packageCsv, packageHtml } from "./reports";
import type { CaseDetail, PackageSnapshot } from "@/shared/types";
const cases = [
  { title: "Approved grounds coding", amountCents: 221416, status: "approved", nextAction: "Record correction", owner: "Staff accountant" },
  { title: "Office invoice <review>", amountCents: 50234, status: "awaiting_evidence", nextAction: "Provide supporting records", owner: "=HYPERLINK(\"x\")" },
].map((c, index) => ({ ...c, id: `case-${index}`, evidenceVersion: 1, revision: 2, execution: null })) as CaseDetail[];
const snapshot = { id: "package-1", version: 1, propertyId: "P105", propertyName: "Sunset Ridge", importId: "import-1", createdAt: "2026-10-31T12:00:00Z", createdBy: "Manager", summary: "<script>unsafe</script>", cases, source: { filename: "close.xlsx", period: "September 2026", hash: "abc123" }, openCount: 2 } as PackageSnapshot;
describe("frozen report rendering", () => {
  it("includes every open case and distinguishes approval from execution", () => {
    const output = packageHtml(snapshot);
    expect(output).toContain("Approved · execution pending");
    expect(output).toContain("Awaiting evidence");
    expect(output).toContain("2 open items included");
    expect(output).toContain("Audit details");
    expect(output).not.toContain("<script>unsafe</script>");
    expect(output).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
  });
  it("preserves rows and protects text cells from spreadsheet formulas", () => {
    const output = packageCsv(snapshot);
    expect(output.split("\r\n")).toHaveLength(3);
    expect(output).toContain("'=");
    expect(output).toContain("2214.16");
    expect(output).toContain("Office invoice <review>");
  });
});
