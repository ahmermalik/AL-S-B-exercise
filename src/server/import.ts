import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { CloseStep, ImportSummary, Property, SourceRef } from "../shared/types";

export interface Invoice {
  line: number; invoice: string; vendor: string; propertyId: string; propertyName: string;
  gl: string; description: string; amountCents: number; invoiceDate: string; receivedDate: string;
  approval: string; codedBy: string; source: SourceRef; raw: unknown[];
}
export interface Variance {
  propertyId: string; propertyName: string; region: string; category: string;
  budgetCents: number; actualCents: number; commentary: string; source: SourceRef; raw: unknown[];
}
export interface ParsedWorkbook {
  summary: ImportSummary; properties: Property[]; accounts: {code: string; name: string; category: string; source: SourceRef}[];
  invoices: Invoice[]; variances: Variance[]; rawSheets: Record<string, unknown[][]>;
}
export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "DomainError"; }
}
export const toCents = (value: number) => Math.round(value * 100);
export const exceedsCommentaryThreshold = (budgetCents: number, actualCents: number) => budgetCents === 0 ? actualCents !== 0 : Math.abs(actualCents - budgetCents) * 100 > Math.abs(budgetCents) * 10;
export const requiresRegionalApproval = (amountCents: number) => amountCents > 1_000_000;
export const normalizeInvoice = (value: string) => value.trim().toUpperCase().replace(/^INV-/, "").replace(/\s/g, "");

function scalar(value: ExcelJS.CellValue): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    if ("result" in value) return scalar(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map(t => t.text).join("");
    if ("text" in value) return value.text;
    throw new DomainError(400, "Unsupported workbook cell content.");
  }
  return value ?? null;
}
function rows(sheet: ExcelJS.Worksheet) {
  const result: {number: number; values: unknown[]}[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = Array.from({ length: sheet.columnCount }, (_, i) => scalar(row.getCell(i + 1).value));
    if (values.some(v => v !== null && v !== "")) result.push({ number, values });
  });
  return result;
}
const str = (v: unknown) => v === null || v === undefined ? "" : String(v).trim();
function number(v: unknown, location: string) {
  const parsed = z.number().finite().safeParse(v);
  if (!parsed.success) throw new DomainError(400, `${location}: expected a finite number.`);
  return parsed.data;
}
function day(v: unknown) { const match = str(v).match(/^BD(\d+)$/i); return match ? Number(match[1]) : null; }
const requiredHeaders: Record<string, string[]> = {
  "B0 Properties": ["Property ID", "Property", "Segment", "Market", "Region", "Units", "Status"],
  "B1 Chart of Accounts": ["GL Code", "Account Name", "Category"],
  "B2 AP Invoices Sep-26": ["Line #", "Invoice #", "Vendor", "Property ID", "Property", "GL Code", "Description", "Amount ($)", "Invoice Date", "Received Date", "Approval Status", "Coded By"],
  "B3 Budget vs Actual Sep-26": ["Property ID", "Property", "Region", "Category", "Sep-26 Budget ($)", "Sep-26 Actual ($)", "Variance Commentary"],
  "B4 Close Tracker": ["Property ID", "Property", "Region", "Staff Accountant", "Close Step", "Due (Business Day)", "Completed (Business Day)", "Status (as of BD6)"],
};
export async function parseWorkbook(buffer: Buffer, filename: string): Promise<ParsedWorkbook> {
  if (!filename.toLowerCase().endsWith(".xlsx")) throw new DomainError(400, "Choose an .xlsx workbook.");
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new DomainError(400, "Workbook must be between 1 byte and 20 MB.");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new DomainError(400, "The file could not be read as an Excel workbook."); }
  for (const [name, headers] of Object.entries(requiredHeaders)) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) throw new DomainError(400, `Missing required sheet: ${name}.`);
    for (let i = 0; i < headers.length; i++) if (str(scalar(sheet.getRow(1).getCell(i + 1).value)) !== headers[i]) throw new DomainError(400, `${name}: column ${i + 1} must be ${headers[i]}.`);
  }
  const readme = workbook.getWorksheet("README");
  if (!readme) throw new DomainError(400, "Missing required sheet: README.");
  const policy = str(scalar(readme.getCell("A18").value));
  if (!policy.includes("10,000") || !policy.includes("10%") || !policy.includes("Regional Manager")) throw new DomainError(400, "README policy context does not match this close pack.");
  const hash = createHash("sha256").update(buffer).digest("hex");
  const rawSheets: Record<string, unknown[][]> = {};
  for (const name of Object.keys(requiredHeaders)) rawSheets[name] = rows(workbook.getWorksheet(name)!).map(r => r.values);
  rawSheets.README = [["A18", policy], ["A5", scalar(readme.getCell("A5").value)]];
  const properties: Property[] = rows(workbook.getWorksheet("B0 Properties")!).map(({values: v}) => ({
    id: str(v[0]), name: str(v[1]), region: str(v[4]), active: str(v[6]) === "Active",
    accountant: "Unassigned", steps: [], lateCount: 0, caseCount: 0, commentaryGaps: 0,
  }));
  if (!properties.length || new Set(properties.map(p => p.id)).size !== properties.length) throw new DomainError(400, "Property IDs must be unique and nonempty.");
  const propertyMap = new Map(properties.map(p => [p.id, p]));
  const accounts = rows(workbook.getWorksheet("B1 Chart of Accounts")!).map(({number: row, values: v}) => ({code: str(v[0]), name: str(v[1]), category: str(v[2]), source: {sheet: "B1 Chart of Accounts", row}}));
  const accountSet = new Set(accounts.map(a => a.code));
  const invoices: Invoice[] = rows(workbook.getWorksheet("B2 AP Invoices Sep-26")!).map(({number: row, values: v}) => {
    if (!propertyMap.has(str(v[3]))) throw new DomainError(400, `B2 row ${row}: unknown property ${str(v[3])}.`);
    if (!accountSet.has(str(v[5]))) throw new DomainError(400, `B2 row ${row}: unknown GL code ${str(v[5])}.`);
    if (!str(v[1]) || !str(v[2])) throw new DomainError(400, `B2 row ${row}: invoice number and vendor are required.`);
    return {line: number(v[0], `B2 row ${row}`), invoice: str(v[1]), vendor: str(v[2]), propertyId: str(v[3]), propertyName: str(v[4]), gl: str(v[5]), description: str(v[6]), amountCents: toCents(number(v[7], `B2 row ${row}`)), invoiceDate: str(v[8]), receivedDate: str(v[9]), approval: str(v[10]), codedBy: str(v[11]), source: {sheet: "B2 AP Invoices Sep-26", row, range: `A${row}:L${row}`}, raw: v};
  });
  const variances: Variance[] = rows(workbook.getWorksheet("B3 Budget vs Actual Sep-26")!).map(({number: row, values: v}) => {
    if (!propertyMap.has(str(v[0]))) throw new DomainError(400, `B3 row ${row}: unknown property.`);
    return {propertyId: str(v[0]), propertyName: str(v[1]), region: str(v[2]), category: str(v[3]), budgetCents: toCents(number(v[4], `B3 row ${row}`)), actualCents: toCents(number(v[5], `B3 row ${row}`)), commentary: str(v[6]), source: {sheet: "B3 Budget vs Actual Sep-26", row, range: `A${row}:G${row}`}, raw: v};
  });
  for (const {number: row, values: v} of rows(workbook.getWorksheet("B4 Close Tracker")!)) {
    const property = propertyMap.get(str(v[0]));
    if (!property) throw new DomainError(400, `B4 row ${row}: unknown property.`);
    const dueBD = day(v[5]); const completedBD = day(v[6]);
    if (dueBD === null) throw new DomainError(400, `B4 row ${row}: invalid due business day.`);
    const step: CloseStep = { name: str(v[4]), dueBD, completedBD, status: str(v[7]), conflict: completedBD !== null && completedBD > 6, source: {sheet: "B4 Close Tracker", row, range: `A${row}:H${row}`} };
    property.accountant = str(v[3]); property.steps.push(step);
    if (step.status === "Late") property.lateCount++;
  }
  for (const v of variances) if (exceedsCommentaryThreshold(v.budgetCents, v.actualCents) && !v.commentary) propertyMap.get(v.propertyId)!.commentaryGaps++;
  const warnings = ["The workbook general date differs from the September close's BD6 scenario; the BD6 scenario is used."];
  const future = properties.flatMap(p => p.steps).filter(s => s.conflict).length;
  if (future) warnings.push(`${future} close steps have completion dates after BD6.`);
  return {summary: {id: `IMP-${hash.slice(0, 12)}`, hash, filename, createdAt: new Date().toISOString(), period: "September 2026", asOfBD: 6, counts: {properties: properties.length, activeProperties: properties.filter(p => p.active).length, invoices: invoices.length, variances: variances.length, steps: properties.reduce((n, p) => n + p.steps.length, 0)}, warnings}, properties, accounts, invoices, variances, rawSheets};
}
