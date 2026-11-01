import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { Briefing, BriefingItem, CaseAction, CaseDetail, CaseSummary, ImportSummary, PackageDraft, PackageSnapshot, Proposal, Role, Run, SupportInput, Workspace } from "../shared/types";
import { installResetGuards, sqlite } from "./db";
import { DomainError, parseWorkbook, type ParsedWorkbook } from "./import";
import { buildRuleProposal, codingCategories, executionTemplate, findCases, history, invoiceIdentityIssue, needsAccountingTreatmentReview, sourceInvoiceReference, supportOf, type ProposalInput } from "./domain";
import { computeAttention } from "./operations";
export { DomainError, buildRuleProposal };
export type Actor = {id: string; name: string; role: Role};
export type RunPatch = Partial<Pick<Run, "stage" | "progress" | "status" | "error" | "completedCases" | "totalCases">>;
const now = () => new Date().toISOString();
const json = <T>(row: unknown, column = "data"): T | null => row ? JSON.parse((row as Record<string, string>)[column]) as T : null;
const closed = new Set(["resolved", "dismissed"]);
const runLease = 60_000;
function archiveDirectory() {
  const configuredPath = process.env.DATABASE_PATH || "data/asset-living.sqlite";
  const root = configuredPath === ":memory:" ? resolve("data") : dirname(resolve(/* turbopackIgnore: true */ configuredPath));
  return resolve(/* turbopackIgnore: true */ root, "sources");
}
function archiveWorkbook(buffer: Buffer, hash: string) {
  const path = resolve(/* turbopackIgnore: true */ archiveDirectory(), `${hash}.xlsx`);
  mkdirSync(dirname(path), {recursive: true});
  if (existsSync(path)) {
    if (createHash("sha256").update(readFileSync(path)).digest("hex") !== hash) throw new DomainError(500, "The archived source failed its integrity check.");
  } else {
    try { writeFileSync(path, buffer, {flag: "wx"}); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
}
export function getResetGeneration(): string {
  const existing = sqlite.prepare("SELECT value FROM close_settings WHERE key='reset_generation'").get() as {value: string} | undefined;
  if (existing) return existing.value;
  return sqlite.transaction(() => {
    sqlite.prepare("INSERT OR IGNORE INTO close_settings(key,value) VALUES ('reset_generation',?)").run(randomUUID());
    return (sqlite.prepare("SELECT value FROM close_settings WHERE key='reset_generation'").get() as {value: string}).value;
  }).immediate();
}
export function assertResetGeneration(expected: string): void {
  if (typeof expected !== "string" || expected !== getResetGeneration()) throw new DomainError(409, "The workspace was reset. Reload it before continuing.");
}
function scopeImport(parsed: ParsedWorkbook, generation: string) {
  parsed.summary.id = `IMP-${generation}-${parsed.summary.hash.slice(0, 12)}`;
  return parsed;
}
function role(actor: Actor, allowed: Role[]) { if (!allowed.includes(actor.role)) throw new DomainError(403, "Your account cannot perform this action."); }
function activeImport(): ParsedWorkbook | null {
  const selected = sqlite.prepare("SELECT value FROM close_settings WHERE key='active_import'").get() as {value: string} | undefined;
  const row = selected ? sqlite.prepare("SELECT payload FROM close_imports WHERE id=?").get(selected.value) : sqlite.prepare("SELECT payload FROM close_imports ORDER BY created_at DESC, rowid DESC LIMIT 1").get();
  return json<ParsedWorkbook>(row, "payload");
}
function readCase(id: string) { return json<CaseDetail>(sqlite.prepare("SELECT data FROM close_cases WHERE id=?").get(id)); }
function decorate(c: CaseDetail) {
  const result = structuredClone(c);
  if (c.kind === "coding") { const categories = codingCategories(c); result.facts.currentCategory = categories.current; result.facts.expectedCategory = categories.expected; }
  result.facts.executionTemplate = executionTemplate(c);
  return result;
}
export function getCase(id: string): CaseDetail | null { const c = readCase(id); return c ? decorate(c) : null; }
function listCases(importId: string) { return (sqlite.prepare("SELECT data FROM close_cases WHERE import_id=? ORDER BY property_id, kind, id").all(importId)).map(r => json<CaseDetail>(r)!); }
function writeCase(c: CaseDetail, expectedRevision: number) {
  c.revision = expectedRevision + 1;
  if (sqlite.prepare("UPDATE close_cases SET revision=?, data=? WHERE id=? AND revision=?").run(c.revision, JSON.stringify(c), c.id, expectedRevision).changes !== 1) throw new DomainError(409, "The case changed. Reload it before continuing.");
}
function addProposal(c: CaseDetail, input: ProposalInput) {
  const p: Proposal = {...input, id: randomUUID(), version: (c.proposals.at(-1)?.version || 0) + 1, disposition: "pending", createdAt: now()};
  c.proposals.push(p); c.status = p.missing.length ? "awaiting_evidence" : "ready";
  c.nextAction = p.missing[0] || "Manager review of the current proposal";
  return p;
}
export async function importWorkbook(buffer: Buffer, filename: string, options: {expectedGeneration?: string} = {}) {
  const generation = options.expectedGeneration || getResetGeneration();
  assertResetGeneration(generation);
  const parsed = await parseWorkbook(buffer, filename);
  return sqlite.transaction(() => {
    assertResetGeneration(generation);
    const existing = json<ParsedWorkbook>(sqlite.prepare("SELECT payload FROM close_imports WHERE hash=?").get(parsed.summary.hash), "payload");
    if (existing) {
      sqlite.prepare("INSERT INTO close_settings(key,value) VALUES ('active_import',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(existing.summary.id);
      return existing.summary;
    }
    scopeImport(parsed, generation);
    archiveWorkbook(buffer, parsed.summary.hash);
    sqlite.prepare("INSERT OR IGNORE INTO close_imports(id,hash,created_at,summary,payload) VALUES (?,?,?,?,?)").run(parsed.summary.id, parsed.summary.hash, parsed.summary.createdAt, JSON.stringify(parsed.summary), JSON.stringify(parsed));
    sqlite.prepare("INSERT INTO close_settings(key,value) VALUES ('active_import',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(parsed.summary.id);
    return json<ParsedWorkbook>(sqlite.prepare("SELECT payload FROM close_imports WHERE id=?").get(parsed.summary.id), "payload")!.summary;
  }).immediate();
}
type OriginalSource = {hash: string; filename: string};
export interface ResetWorkspaceResult {
  resetGeneration: string;
  reloadedSource: boolean;
  source: ImportSummary | null;
  cleared: Record<string, number>;
  removedArchivedFiles: number;
  cleanupWarnings: string[];
}
function originalSourceMetadata(): OriginalSource | null {
  const manifest = resolve(/* turbopackIgnore: true */ archiveDirectory(), "original-source.json");
  if (existsSync(manifest)) {
    try { return z.object({hash: z.string().regex(/^[a-f0-9]{64}$/), filename: z.string().min(1).max(500)}).parse(JSON.parse(readFileSync(manifest, "utf8"))); }
    catch { throw new DomainError(409, "The original workbook archive index is invalid. Restore the source before resetting."); }
  }
  const first = json<ParsedWorkbook>(sqlite.prepare("SELECT payload FROM close_imports ORDER BY created_at,rowid LIMIT 1").get(), "payload");
  return first ? {hash: first.summary.hash, filename: first.summary.filename} : null;
}
async function originalWorkbookForReset() {
  const baseline = originalSourceMetadata();
  const archived = baseline ? resolve(/* turbopackIgnore: true */ archiveDirectory(), `${baseline.hash}.xlsx`) : null;
  const configured = resolve(/* turbopackIgnore: true */ process.env.SOURCE_WORKBOOK_PATH || "seed/close-pack.xlsx");
  const path = archived && existsSync(archived) ? archived : existsSync(configured) ? configured : null;
  if (!path) throw new DomainError(409, "The original workbook is unavailable. Restore the source before resetting.");
  let buffer: Buffer;
  try { buffer = readFileSync(path); }
  catch { throw new DomainError(409, "The original workbook could not be read. No workspace data was cleared."); }
  const parsed = await parseWorkbook(buffer, baseline?.filename || "September 2026 Close Pack.xlsx");
  if (baseline && parsed.summary.hash !== baseline.hash) throw new DomainError(409, "The original workbook no longer matches its archived source. No workspace data was cleared.");
  return {buffer, parsed, baseline: baseline || {hash: parsed.summary.hash, filename: parsed.summary.filename}};
}
/** Reset accounting workflow state only. Authentication records and schema migrations remain. */
export async function resetWorkspace(options: {reloadSource?: boolean; expectedGeneration?: string} = {}): Promise<ResetWorkspaceResult> {
  const parsedOptions = z.object({reloadSource: z.boolean().default(true), expectedGeneration: z.string().min(1).optional()}).safeParse(options);
  if (!parsedOptions.success) throw new DomainError(400, "Invalid reset options.");
  const generation = parsedOptions.data.expectedGeneration || getResetGeneration();
  assertResetGeneration(generation);
  // Resolve, read, hash-check and validate the original before any destructive transaction.
  const original = parsedOptions.data.reloadSource ? await originalWorkbookForReset() : null;
  const baseline = original?.baseline || originalSourceMetadata();
  const nextGeneration = randomUUID();
  const result = sqlite.transaction(() => {
    assertResetGeneration(generation);
    // Old-loaded workers also pass through this database-level stale-audit guard.
    installResetGuards();
    const archivedHashes = (sqlite.prepare("SELECT hash FROM close_imports").all() as {hash: string}[]).map(row => row.hash);
    const tables = ["close_run_cases", "close_agent_activity", "close_packages", "close_cases", "close_runs", "close_imports", "close_settings"] as const;
    const cleared = Object.fromEntries(tables.map(table => [table, (sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {count: number}).count]));
    if (baseline) {
      const manifest = resolve(/* turbopackIgnore: true */ archiveDirectory(), "original-source.json");
      mkdirSync(dirname(manifest), {recursive: true});
      if (!existsSync(manifest)) writeFileSync(manifest, JSON.stringify(baseline), {flag: "wx"});
    }
    for (const table of tables) sqlite.prepare(`DELETE FROM ${table}`).run();
    sqlite.prepare("INSERT INTO close_settings(key,value) VALUES ('reset_generation',?)").run(nextGeneration);
    let source: ImportSummary | null = null;
    if (original) {
      scopeImport(original.parsed, nextGeneration);
      archiveWorkbook(original.buffer, original.parsed.summary.hash);
      const p = original.parsed;
      sqlite.prepare("INSERT INTO close_imports(id,hash,created_at,summary,payload) VALUES (?,?,?,?,?)").run(p.summary.id, p.summary.hash, p.summary.createdAt, JSON.stringify(p.summary), JSON.stringify(p));
      sqlite.prepare("INSERT INTO close_settings(key,value) VALUES ('active_import',?)").run(p.summary.id);
      source = p.summary;
    }
    return {resetGeneration: nextGeneration, reloadedSource: !!source, source, cleared, removedArchivedFiles: 0, cleanupWarnings: [] as string[], archivedHashes};
  }).immediate();
  // File removal is restricted to generated archives referenced by the cleared imports.
  // Serializing against imports prevents removing a newly-uploaded active source.
  try {
    sqlite.transaction(() => {
      if (getResetGeneration() !== nextGeneration) { result.cleanupWarnings.push("Archive cleanup skipped after a newer workspace reset.");return; }
      const retained = new Set((sqlite.prepare("SELECT hash FROM close_imports").all() as {hash: string}[]).map(row => row.hash));
      if (baseline) retained.add(baseline.hash);
      for (const hash of result.archivedHashes) {
        if (!/^[a-f0-9]{64}$/.test(hash) || retained.has(hash)) continue;
        const path = resolve(/* turbopackIgnore: true */ archiveDirectory(), `${hash}.xlsx`);
        if (!existsSync(path)) continue;
        try {
          if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) { result.cleanupWarnings.push("A non-regular source archive was retained.");continue; }
          unlinkSync(path);result.removedArchivedFiles++;
        } catch { result.cleanupWarnings.push("A source archive could not be removed."); }
      }
    }).immediate();
  } catch { result.cleanupWarnings.push("Archive cleanup was deferred; the workspace reset completed."); }
  return {resetGeneration: result.resetGeneration, reloadedSource: result.reloadedSource, source: result.source, cleared: result.cleared, removedArchivedFiles: result.removedArchivedFiles, cleanupWarnings: result.cleanupWarnings};
}
export function getWorkspace(): Workspace {
  const source = activeImport();
  const all = source ? listCases(source.summary.id) : [];
  const properties = source?.properties.map(p => ({...p, caseCount: all.filter(c => c.propertyId === p.id && !closed.has(c.status)).length})) || [];
  return {resetGeneration: getResetGeneration(), source: source?.summary || null, properties, cases: all.map(summaryOf), run: source ? getRunForImport(source.summary.id) : null,
    metrics: {activeProperties: properties.filter(p => p.active).length, lateProperties: properties.filter(p => p.active && p.lateCount).length, commentaryGaps: properties.filter(p => p.active).reduce((n, p) => n + p.commentaryGaps, 0), openCases: all.filter(c => !closed.has(c.status)).length},
    attention: source ? computeAttention(source, all) : null,
    ai: {configured: !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_MODEL, model: process.env.OPENAI_MODEL || null}};
}
/** Active import and its cases, for derived operational views. */
export function operationsSource(): {parsed: ParsedWorkbook; cases: CaseDetail[]} {
  const parsed = activeImport();
  if (!parsed) throw new DomainError(404, "Import a close workbook first.");
  return {parsed, cases: listCases(parsed.summary.id)};
}
export function latestBriefing(importId: string): Briefing | null {
  const record = json<Record<string, unknown>>(sqlite.prepare("SELECT data FROM close_agent_activity WHERE case_id IS NULL AND run_id IS NULL AND json_extract(data,'$.event')='priorities_briefing' AND json_extract(data,'$.importId')=? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(importId));
  if (!record || !Array.isArray(record.items)) return null;
  return {importId, fingerprint: String(record.fingerprint), items: record.items as BriefingItem[], links: (record.links || {}) as Record<string, string>, model: String(record.model), promptVersion: String(record.promptVersion), createdAt: String(record.createdAt)};
}
/** Persists a validated briefing; returns false when the workspace was reset or the import changed meanwhile. */
export function saveBriefing(briefing: Omit<Briefing, "createdAt">, generation: string): boolean {
  return recordAgentActivity({event: "priorities_briefing", importId: briefing.importId, resetGeneration: generation, fingerprint: briefing.fingerprint, items: briefing.items, links: briefing.links, model: briefing.model, promptVersion: briefing.promptVersion});
}
function summaryOf(c: CaseDetail): CaseSummary {
  return {id: c.id, importId: c.importId, propertyId: c.propertyId, propertyName: c.propertyName, kind: c.kind, title: c.title, amountCents: c.amountCents, status: c.status, revision: c.revision, evidenceVersion: c.evidenceVersion, nextAction: c.nextAction, owner: c.owner};
}
export function prepareFindings(importId: string) {
  const parsed = json<ParsedWorkbook>(sqlite.prepare("SELECT payload FROM close_imports WHERE id=?").get(importId), "payload");
  if (!parsed) throw new DomainError(404, "Source import not found.");
  const findings = findCases(parsed);
  sqlite.transaction(() => {
    if (!sqlite.prepare("SELECT id FROM close_imports WHERE id=?").get(importId)) throw new DomainError(409, "The workspace changed before preparation could be saved.");
    const put = sqlite.prepare("INSERT OR IGNORE INTO close_cases(id,import_id,property_id,kind,revision,data) VALUES (?,?,?,?,?,?)");
    for (const c of findings) put.run(c.id, c.importId, c.propertyId, c.kind, c.revision, JSON.stringify(c));
  })();
}
export function prepareRunFindings(runId: string, workerId: string): boolean {
  return sqlite.transaction(() => {
    if (!ownsRun(runId, workerId)) return false;
    const run = getRun(runId);
    if (!run || !sqlite.prepare("SELECT id FROM close_imports WHERE id=?").get(run.importId)) return false;
    prepareFindings(run.importId);
    return true;
  }).immediate();
}
export function listRunCases(importId: string) { return listCases(importId).map(decorate); }

const short = z.string().trim().min(1).max(200);
const note = z.string().trim().min(1).max(6000);
const supportSchema = z.object({author: short, period: short, explanation: z.string().trim().max(4000), transactionId: z.string().trim().max(200), retainedTransactionId: z.string().trim().max(200).optional(), entity: z.string().trim().max(200), postingState: z.enum(["posted", "unposted", "unknown"]), paymentState: z.enum(["unpaid", "scheduled", "paid", "unknown"]), duplicateConfirmed: z.boolean(), periodOpen: z.boolean(), correctionAuthorized: z.boolean(), invoiceRecord: z.string().trim().max(6000), ledgerRecord: z.string().trim().max(6000), paymentRecord: z.string().trim().max(6000), policyRecord: z.string().trim().max(6000),
  invoiceReference: z.string().trim().max(200).optional(),
  approvalRecords: z.array(z.object({invoiceRow: z.number().int().positive(), approverRole: short, reference: short, approvedBeforePayment: z.boolean()})).max(100).optional(),
  closeRecords: z.array(z.object({step: short, completedBD: z.number().int().min(1).max(31), reference: short})).max(20).optional(),
});
const revision = {expectedRevision: z.number().int().positive()};
const actionSchema = z.discriminatedUnion("action", [
  z.object({action: z.literal("request"), ...revision, text: note}),
  z.object({action: z.literal("support"), ...revision, support: supportSchema}),
  z.object({action: z.enum(["prepare", "revise-ai"]), ...revision}),
  z.object({action: z.literal("edit"), ...revision, summary: z.string().trim().min(1).max(4000)}),
  z.object({action: z.literal("approve"), ...revision, proposalId: short}),
  z.object({action: z.enum(["return", "dismiss"]), ...revision, reason: note}),
  z.object({action: z.literal("execute"), ...revision, reference: short, targetId: short, amountCents: z.number().int().safe(), notes: note, refreshedRecord: note}),
  z.object({action: z.enum(["verify", "resolve"]), ...revision}),
]);
export function applyCaseAction(id: string, unsafeAction: CaseAction, actor: Actor): CaseDetail {
  const parsed = actionSchema.safeParse(unsafeAction);
  if (!parsed.success) throw new DomainError(400, parsed.error.issues[0]?.message || "Invalid case action.");
  const action = parsed.data;
  return sqlite.transaction(() => {
    const c = readCase(id);
    if (!c) throw new DomainError(404, "Case not found.");
    if (c.revision !== action.expectedRevision) throw new DomainError(409, "The case changed. Reload it before continuing.");
    const latest = c.proposals.at(-1)!;
    const reviewActions = new Set(["request", "prepare", "edit", "return", "dismiss"]);
    if (reviewActions.has(action.action) && !["candidate", "awaiting_evidence", "ready"].includes(c.status)) throw new DomainError(409, "This action requires an open review. Add new source evidence to reopen a reviewed case.");
    switch (action.action) {
      case "request":
        role(actor, ["manager", "accountant"]);
        c.requests.push({id: randomUUID(), text: action.text, author: actor.name, at: now(), status: "open"});
        c.status = "awaiting_evidence"; c.nextAction = action.text;
        c.history.push(history(actor.name, "Requested supporting information."));
        break;
      case "support": {
        role(actor, ["accountant"]);
        const s = action.support;
        if (s.period !== "September 2026") throw new DomainError(400, "Support must identify September 2026.");
        if (JSON.stringify(s) === JSON.stringify(c.facts.support)) return decorate(c);
        c.evidenceVersion++;
        c.facts.support = s;
        if (s.approvalRecords) {
          const invoices = c.facts.invoices as {source: {row: number}}[] | undefined;
          if (c.kind !== "approval" || new Set(s.approvalRecords.map(r => r.invoiceRow)).size !== s.approvalRecords.length || s.approvalRecords.some(r => !invoices?.some(i => i.source.row === r.invoiceRow))) throw new DomainError(400, "Approval records must identify distinct invoice rows in this case.");
        }
        if (s.closeRecords) {
          const affected = [...((c.facts.lateSteps as {name: string}[]) || []), ...((c.facts.conflictingSteps as {name: string}[]) || [])];
          if (c.kind !== "close" || new Set(s.closeRecords.map(r => r.step)).size !== s.closeRecords.length || s.closeRecords.some(r => !affected.some(step => step.name === r.step))) throw new DomainError(400, "Close records must identify distinct affected steps in this case.");
        }
        c.facts.supportOrigin = getSupportTemplate(id)?.transactionId === s.transactionId && s.invoiceRecord.startsWith("Invoice record") ? "prepared_fixture" : "operator_supplied";
        const records = [
          ["Staff explanation", "attestation", s.explanation], ["Invoice record", "invoice", s.invoiceRecord],
          ["Ledger / source register", "ledger", s.ledgerRecord], ["Payment evidence", "payment", s.paymentRecord], ["Period and authority", "policy", s.policyRecord],
        ];
        const recordedBy = {id: actor.id, name: actor.name};
        for (const [label, kind, text] of records) if (text) c.evidence.push({id: `EVD-${randomUUID()}`, label, kind, author: s.author, text, version: c.evidenceVersion, createdAt: now(), data: {recordedBy, ...(kind === "attestation" ? {} : {invoiceReference: s.invoiceReference || null, transactionId: s.transactionId, entity: s.entity, postingState: s.postingState, paymentState: s.paymentState, origin: c.facts.supportOrigin})}});
        if (s.approvalRecords?.length) c.evidence.push({id: `EVD-${randomUUID()}`, label: "Regional approval records", kind: "approval", author: s.author, text: JSON.stringify(s.approvalRecords, null, 2), data: {records: s.approvalRecords, recordedBy}, version: c.evidenceVersion, createdAt: now()});
        if (s.closeRecords?.length) c.evidence.push({id: `EVD-${randomUUID()}`, label: "Updated close work records", kind: "close", author: s.author, text: JSON.stringify(s.closeRecords, null, 2), data: {records: s.closeRecords, recordedBy}, version: c.evidenceVersion, createdAt: now()});
        if (c.execution) { c.facts.executionHistory = [...((c.facts.executionHistory as unknown[]) || []), c.execution]; c.execution = null; }
        c.status = "awaiting_evidence"; c.nextAction = "Prepare a revised proposal from the new evidence";
        c.history.push(history(actor.name, `Recorded support from ${s.author} as E${c.evidenceVersion}; earlier review is historical.`));
        break;
      }
      case "prepare":
        role(actor, ["manager", "accountant"]);
        addProposal(c, buildRuleProposal(c));
        c.history.push(history(actor.name, "Prepared a proposal from current evidence."));
        break;
      case "revise-ai": throw new DomainError(400, "AI revisions must use the agent service.");
      case "edit":
        role(actor, ["manager"]);
        addProposal(c, {...buildRuleProposal(c), summary: action.summary, origin: "manager"});
        c.history.push(history(actor.name, "Saved a separate wording revision."));
        break;
      case "approve": {
        role(actor, ["manager"]);
        if (needsAccountingTreatmentReview(c)) throw new DomainError(409, "A supported accounting-treatment decision is required; generic expense-reclass authority is insufficient.");
        const identityIssue = invoiceIdentityIssue(c);
        if (identityIssue) throw new DomainError(409, `Supporting evidence is incomplete: ${identityIssue}.`);
        if (latest.id !== action.proposalId || latest.evidenceVersion !== c.evidenceVersion) throw new DomainError(409, "Review the latest proposal and evidence before approving.");
        if (latest.missing.length && c.kind !== "variance") throw new DomainError(409, "Supporting evidence is incomplete; the correction is not ready for approval.");
        if (!["ready", "awaiting_evidence", "candidate"].includes(c.status)) throw new DomainError(409, "This case is not awaiting proposal review.");
        if (latest.disposition === "approved") return decorate(c);
        if (latest.journal.reduce((n, l) => n + l.debitCents - l.creditCents, 0) !== 0 || latest.journal.some(l => l.debitCents < 0 || l.creditCents < 0)) throw new DomainError(400, "The proposed journal is not balanced.");
        latest.disposition = "approved";
        const evidenceOnly = ["variance", "approval", "close"].includes(c.kind);
        c.status = evidenceOnly ? latest.missing.length ? "awaiting_evidence" : "verified" : "approved";
        c.nextAction = evidenceOnly ? latest.missing[0] || "Confirm supported issue resolution" : "Record authorized execution and refreshed evidence";
        c.history.push(history(actor.name, `Approved proposal v${latest.version} / E${c.evidenceVersion}${c.kind === "variance" ? " wording; remaining support stays open." : "; execution is separate."}`));
        break;
      }
      case "return":
        role(actor, ["manager"]); latest.disposition = "returned";
        c.status = "awaiting_evidence"; c.nextAction = action.reason;
        c.history.push(history(actor.name, `Returned proposal v${latest.version}: ${action.reason}`));
        break;
      case "dismiss":
        role(actor, ["manager"]); c.status = "dismissed"; c.nextAction = "Retain review evidence";
        c.history.push(history(actor.name, `Dismissed with reason: ${action.reason}`));
        break;
      case "execute": {
        role(actor, ["accountant"]);
        if (needsAccountingTreatmentReview(c)) throw new DomainError(409, "This classification requires an accounting-treatment review before execution.");
        const identityIssue = invoiceIdentityIssue(c);
        if (identityIssue) throw new DomainError(409, `Current source invoice identity is not established: ${identityIssue}.`);
        const s = supportOf(c);
        if (!["approved", "executed", "verification_failed"].includes(c.status) || latest.disposition !== "approved" || latest.evidenceVersion !== c.evidenceVersion || !s) throw new DomainError(409, "A current approved correction is required before recording execution.");
        if (action.targetId !== s.transactionId) throw new DomainError(400, "The execution target differs from the approved source transaction.");
        let record: unknown;
        try { record = JSON.parse(action.refreshedRecord); } catch { throw new DomainError(400, "The refreshed record must contain structured ledger/source data."); }
        if (!record || typeof record !== "object" || Array.isArray(record)) throw new DomainError(400, "A refreshed source record is required.");
        if (c.execution) c.facts.executionHistory = [...((c.facts.executionHistory as unknown[]) || []), c.execution];
        c.facts.refreshedRecord = record;
        c.execution = {reference: action.reference, targetId: action.targetId, amountCents: action.amountCents, notes: action.notes, proposalId: latest.id, evidenceVersion: c.evidenceVersion, at: now(), verified: false};
        c.evidence.push({id: `EXE-${randomUUID()}`, label: action.reference, kind: "execution", author: actor.name, text: action.notes, data: record as Record<string, unknown>, version: c.evidenceVersion, createdAt: now()});
        c.status = "executed"; c.nextAction = "Compare the refreshed records with the approved correction";
        c.history.push(history(actor.name, `Recorded execution ${action.reference}; verification pending.`));
        break;
      }
      case "verify": {
        role(actor, ["manager", "accountant"]);
        const x = c.execution, expected = executionTemplate(c), record = c.facts.refreshedRecord as Record<string, unknown> | undefined;
        if (!x || !expected || !record || !["executed", "verification_failed"].includes(c.status)) throw new DomainError(409, "Record the approved correction and refreshed records first.");
        const keys = Object.keys(expected).filter(k => k !== "recordSource");
        const pass = !!record.recordSource && keys.every(k => record[k] === expected[k]) && x.amountCents === c.amountCents && x.proposalId === latest.id && x.evidenceVersion === c.evidenceVersion;
        x.verified = pass; c.status = pass ? "verified" : "verification_failed";
        c.nextAction = pass ? "Manager confirmation of this issue's resolution" : "Correct the conflicting refreshed record or execution details";
        c.history.push(history("Automated comparison", pass ? "Scoped source/ledger checks passed; manager confirmation required." : "Refreshed records do not match the approved correction; issue remains open."));
        break;
      }
      case "resolve":
        role(actor, ["manager"]);
        if (needsAccountingTreatmentReview(c)) throw new DomainError(409, "A supported accounting-treatment decision is required before resolving this classification.");
        if (invoiceIdentityIssue(c)) throw new DomainError(409, "Current source invoice identity must be established before resolving this issue.");
        if (c.status !== "verified" || latest.evidenceVersion !== c.evidenceVersion) throw new DomainError(409, "Current evidence must pass verification before resolution.");
        c.status = "resolved"; c.nextAction = "Retain correction and review evidence";
        for (const request of c.requests) request.status = "closed";
        c.history.push(history(actor.name, "Confirmed this issue resolved. Other cases and property close remain separate."));
        break;
    }
    writeCase(c, action.expectedRevision);
    return decorate(c);
  }).immediate();
}

function validateAgentProposal(c: CaseDetail, input: ProposalInput) {
  const baseline = buildRuleProposal(c);
  if (input.evidenceVersion !== c.evidenceVersion) throw new DomainError(409, "The agent response refers to earlier evidence.");
  if (!input.summary?.trim() || input.summary.length > 4000 || !input.rationale?.trim() || input.rationale.length > 5000) throw new DomainError(400, "The agent response is incomplete or too long.");
  if (JSON.stringify(input.journal) !== JSON.stringify(baseline.journal) || input.route !== baseline.route || JSON.stringify(input.missing) !== JSON.stringify(baseline.missing)) throw new DomainError(400, "The agent cannot change the authoritative correction route, journal or required evidence.");
  if (!input.sources.length || input.sources.some(id => !c.evidence.some(e => e.id === id))) throw new DomainError(400, "The agent response contains an unknown source reference.");
}
export function saveAgentProposal(caseId: string, expectedRevision: number, input: ProposalInput, context?: {runId: string; workerId: string}) {
  return sqlite.transaction(() => {
    if (context && !ownsRun(context.runId, context.workerId)) throw new DomainError(409, "The preparation job is no longer owned by this worker.");
    const c = readCase(caseId);
    if (!c) throw new DomainError(404, "Case not found.");
    if (context && getRun(context.runId)?.importId !== c.importId) throw new DomainError(403, "The case is outside this preparation run's source scope.");
    if (c.revision !== expectedRevision) throw new DomainError(409, "The case changed while the agent was preparing its response.");
    validateAgentProposal(c, input);
    if (closed.has(c.status) || ["approved", "executed", "verified", "verification_failed"].includes(c.status)) throw new DomainError(409, "Agent drafting cannot replace an approved or completed workflow.");
    const latest = c.proposals.at(-1)!;
    if (latest.origin === input.origin && latest.evidenceVersion === input.evidenceVersion && latest.summary === input.summary && latest.rationale === input.rationale) return decorate(c);
    addProposal(c, input); c.history.push(history("Agent", `Prepared proposal v${c.proposals.at(-1)!.version} from current evidence.`)); writeCase(c, expectedRevision);
    return decorate(c);
  }).immediate();
}
export function saveRunAgentProposal(runId: string, workerId: string, caseId: string, expectedRevision: number, input: ProposalInput) {
  return sqlite.transaction(() => {
    if (!ownsRun(runId, workerId)) throw new DomainError(409, "The preparation job is no longer active.");
    const c = saveAgentProposal(caseId, expectedRevision, input, {runId, workerId});
    sqlite.prepare("INSERT INTO close_run_cases(run_id,case_id,status,error) VALUES (?,?,'complete',NULL) ON CONFLICT(run_id,case_id) DO UPDATE SET status='complete',error=NULL").run(runId, caseId);
    return c;
  }).immediate();
}

export function getSupportTemplate(caseId: string): SupportInput | null {
  const c = readCase(caseId);
  if (!c || c.propertyId !== "P105" || !["duplicate", "coding"].includes(c.kind)) return null;
  const labor = c.title.includes("StaffBridge"), office = c.title.includes("Office Depot");
  const token = labor ? "LAB" : office ? "OFF" : "GND";
  if (!labor && !office && !c.title.includes("Lone Star Lawn")) return null;
  const target = `SR-${token}-${c.kind === "duplicate" ? "02" : "01"}`, retained = `SR-${token}-01`;
  const entity = "OWNER-P105", amount = (c.amountCents / 100).toFixed(2);
  const invoiceReference = sourceInvoiceReference(c)!;
  return {author: "Staff accountant", period: "September 2026", explanation: c.kind === "duplicate" ? "One vendor invoice was entered twice. The source records and payment register are included for review." : "The vendor invoice is for recurring grounds maintenance. The source ledger and correction authority are included for review.", invoiceReference, transactionId: target, retainedTransactionId: c.kind === "duplicate" ? retained : "", entity,
    postingState: office ? "unposted" : "posted", paymentState: "unpaid", duplicateConfirmed: c.kind === "duplicate", periodOpen: true, correctionAuthorized: true,
    invoiceRecord: `Invoice record ${invoiceReference}: P105, ${entity}, September 2026, ${amount}. ${c.kind === "coding" ? "Monthly grounds maintenance." : "One invoice obligation."}`,
    ledgerRecord: office ? `Intake register: ${retained} and ${target}; both unposted for one vendor invoice.` : `AP/GL extract: ${target}${c.kind === "duplicate" ? ` and ${retained}` : ""}; P105, ${entity}, ${amount}${c.kind === "coding" ? " posted to 6410 Electric" : " each, posted"}.`,
    paymentRecord: `Payment register: ${target}${c.kind === "duplicate" ? ` and ${retained}` : ""} unpaid; no scheduled payment.`,
    policyRecord: `Configured review policy for P105 / ${entity}: September 2026 remains open. Accounting manager approval permits ${c.kind === "coding" ? "one same-entity manual expense reclassification; do not also recode AP" : office ? "rejection of a confirmed unposted duplicate" : "reversal of the exact duplicate AP bill"}.`,
  };
}

export function getPackageDraft(propertyId: string): PackageDraft {
  const parsed = activeImport();
  if (!parsed) throw new DomainError(404, "Import a close workbook first.");
  const property = parsed.properties.find(p => p.id === propertyId);
  if (!property) throw new DomainError(404, "Property not found.");
  const cases = listCases(parsed.summary.id).filter(c => c.propertyId === propertyId).map(decorate);
  const fingerprint = createHash("sha256").update(JSON.stringify({importId: parsed.summary.id, propertyId, cases: cases.map(c => [c.id, c.revision, c.evidenceVersion])})).digest("hex");
  const snapshots = sqlite.prepare("SELECT data FROM close_packages WHERE import_id=? AND property_id=? ORDER BY version DESC").all(parsed.summary.id, propertyId).map(r => json<PackageSnapshot>(r)!);
  return {propertyId, propertyName: property.name, source: parsed.summary, cases, fingerprint, snapshots};
}
export function savePackage(input: {propertyId: string; fingerprint: string; summary: string | null; acknowledged: boolean}, actor: Actor): PackageSnapshot {
  role(actor, ["manager"]);
  const validated = z.object({propertyId: short, fingerprint: short, summary: z.string().trim().max(5000).nullable(), acknowledged: z.literal(true)}).safeParse(input);
  if (!validated.success) throw new DomainError(400, "Review and acknowledge the package scope and open items before saving.");
  return sqlite.transaction(() => {
    const draft = getPackageDraft(validated.data.propertyId);
    if (draft.fingerprint !== validated.data.fingerprint) throw new DomainError(409, "Case activity changed. Review the current package before saving.");
    if (!draft.cases.length) throw new DomainError(409, "Run preparation before creating a package for this property.");
    const existing = draft.snapshots.find(s => s.source.id === draft.source.id && s.summary === validated.data.summary && createHash("sha256").update(JSON.stringify({importId: s.importId, propertyId: s.propertyId, cases: s.cases.map(c => [c.id, c.revision, c.evidenceVersion])})).digest("hex") === draft.fingerprint);
    if (existing) return existing;
    const snapshot: PackageSnapshot = {id: `PKG-${randomUUID()}`, version: (draft.snapshots[0]?.version || 0) + 1, propertyId: draft.propertyId, propertyName: draft.propertyName, importId: draft.source.id, createdAt: now(), createdBy: actor.name, summary: validated.data.summary, cases: structuredClone(draft.cases), source: structuredClone(draft.source), openCount: draft.cases.filter(c => !closed.has(c.status)).length};
    sqlite.prepare("INSERT INTO close_packages(id,import_id,property_id,version,fingerprint,data) VALUES (?,?,?,?,?,?)").run(snapshot.id, snapshot.importId, snapshot.propertyId, snapshot.version, draft.fingerprint, JSON.stringify(snapshot));
    return snapshot;
  }).immediate();
}
export function getPackage(id: string) { return json<PackageSnapshot>(sqlite.prepare("SELECT data FROM close_packages WHERE id=?").get(id)); }

function getRunForImport(importId: string) { return json<Run>(sqlite.prepare("SELECT data FROM close_runs WHERE import_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1").get(importId)); }
export function getRun(id?: string) { return id ? json<Run>(sqlite.prepare("SELECT data FROM close_runs WHERE id=?").get(id)) : json<Run>(sqlite.prepare("SELECT data FROM close_runs ORDER BY created_at DESC,rowid DESC LIMIT 1").get()); }
export function createRun(importId: string): Run {
  return sqlite.transaction(() => {
    if (!sqlite.prepare("SELECT id FROM close_imports WHERE id=?").get(importId)) throw new DomainError(404, "Import not found.");
    const active = json<Run>(sqlite.prepare("SELECT data FROM close_runs WHERE import_id=? AND status IN ('queued','running') LIMIT 1").get(importId));
    if (active) return active;
    const createdAt = now(); const run: Run = {id: `RUN-${randomUUID()}`, importId, status: "queued", stage: "Queued", progress: 0, error: null, createdAt, updatedAt: createdAt, completedCases: 0, totalCases: 0};
    sqlite.prepare("INSERT INTO close_runs(id,import_id,status,created_at,data) VALUES (?,?,?,?,?)").run(run.id, importId, run.status, createdAt, JSON.stringify(run)); return run;
  }).immediate();
}
export function cancelRun(id: string): Run {
  return sqlite.transaction(() => { const run = getRun(id); if (!run) throw new DomainError(404, "Preparation run not found."); if (["complete", "cancelled"].includes(run.status)) return run; run.status = "cancelled"; run.stage = "Cancelled"; run.updatedAt = now(); sqlite.prepare("UPDATE close_runs SET status='cancelled', lease_owner=NULL,lease_until=NULL,data=? WHERE id=?").run(JSON.stringify(run), id); return run; }).immediate();
}
export function resumeRun(id: string): Run {
  return sqlite.transaction(() => { const run = getRun(id); if (!run) throw new DomainError(404, "Preparation run not found."); if (["queued", "running", "complete"].includes(run.status)) return run; run.status = "queued"; run.stage = "Queued"; run.error = null; run.stageLog = []; run.updatedAt = now(); sqlite.prepare("UPDATE close_runs SET status='queued',lease_owner=NULL,lease_until=NULL,data=? WHERE id=?").run(JSON.stringify(run), id); sqlite.prepare("DELETE FROM close_run_cases WHERE run_id=? AND status='failed'").run(id); return run; }).immediate();
}
function ownsRun(id: string, workerId: string) { return !!sqlite.prepare("SELECT id FROM close_runs WHERE id=? AND status='running' AND lease_owner=? AND lease_until>?").get(id, workerId, Date.now()); }
export function claimRun(workerId: string): Run | null {
  return sqlite.transaction(() => { const row = sqlite.prepare("SELECT data FROM close_runs WHERE status='queued' OR (status='running' AND (lease_until IS NULL OR lease_until<?)) ORDER BY created_at LIMIT 1").get(Date.now()); const run = json<Run>(row); if (!run) return null; run.status = "running"; run.updatedAt = now(); sqlite.prepare("UPDATE close_runs SET status='running',lease_owner=?,lease_until=?,data=? WHERE id=?").run(workerId, Date.now() + runLease, JSON.stringify(run), run.id); return run; }).immediate();
}
export function heartbeatRun(id: string, workerId: string) { return sqlite.prepare("UPDATE close_runs SET lease_until=? WHERE id=? AND status='running' AND lease_owner=? AND lease_until>?").run(Date.now() + runLease, id, workerId, Date.now()).changes === 1; }
export function updateRun(id: string, workerId: string, patch: RunPatch): boolean {
  return sqlite.transaction(() => { if (!ownsRun(id, workerId)) return false; const run = getRun(id)!; const safe = z.object({stage: z.string().max(120).optional(), progress: z.number().min(0).max(100).optional(), status: z.enum(["queued", "running", "cancelled", "partial", "complete", "failed"]).optional(), error: z.string().max(4000).nullable().optional(), completedCases: z.number().int().nonnegative().optional(), totalCases: z.number().int().nonnegative().optional()}).parse(patch); const changedAt = now(); if (safe.stage && safe.stage !== run.stage) run.stageLog = [...(run.stageLog || []), { name: safe.stage, at: changedAt }]; Object.assign(run, safe, {updatedAt: changedAt}); const done = run.status !== "running"; sqlite.prepare("UPDATE close_runs SET status=?,lease_owner=?,lease_until=?,data=? WHERE id=?").run(run.status, done ? null : workerId, done ? null : Date.now() + runLease, JSON.stringify(run), id); return true; }).immediate();
}
export function getRunCaseStates(runId: string): Record<string, {status: "complete" | "failed"; error: string | null}> {
  return Object.fromEntries((sqlite.prepare("SELECT case_id,status,error FROM close_run_cases WHERE run_id=?").all(runId) as {case_id: string; status: "complete" | "failed"; error: string | null}[]).map(row => [row.case_id, {status: row.status, error: row.error}]));
}
export function markRunCase(runId: string, workerId: string, caseId: string, status: "complete" | "failed", error?: string) {
  return sqlite.transaction(() => { if (!ownsRun(runId, workerId) || readCase(caseId)?.importId !== getRun(runId)?.importId) return false; sqlite.prepare("INSERT INTO close_run_cases(run_id,case_id,status,error) VALUES (?,?,?,?) ON CONFLICT(run_id,case_id) DO UPDATE SET status=excluded.status,error=excluded.error").run(runId, caseId, status, error?.slice(0, 2000) || null); return true; }).immediate();
}
export function recordAgentActivity(record: {runId?: string; caseId?: string; [key: string]: unknown}) {
  return sqlite.transaction(() => {
    const generation = getResetGeneration();
    if (record.resetGeneration !== undefined && record.resetGeneration !== generation) return false;
    const c = record.caseId ? readCase(record.caseId) : null;
    const r = record.runId ? getRun(record.runId) : null;
    const importId = typeof record.importId === "string" ? record.importId : c?.importId || r?.importId;
    if (record.caseId && !c || record.runId && !r || !importId || !sqlite.prepare("SELECT id FROM close_imports WHERE id=?").get(importId)) return false;
    if (c && c.importId !== importId || r && r.importId !== importId) return false;
    const value = {...record, importId, resetGeneration: generation, id: randomUUID(), createdAt: now()};
    return sqlite.prepare("INSERT INTO close_agent_activity(id,case_id,run_id,created_at,data) VALUES (?,?,?,?,?)").run(value.id, record.caseId || null, record.runId || null, value.createdAt, JSON.stringify(value)).changes === 1;
  }).immediate();
}
export function recordRunAgentActivity(runId: string, workerId: string, record: {runId?: string; caseId?: string; [key: string]: unknown}): boolean {
  return sqlite.transaction(() => {
    if (!ownsRun(runId, workerId)) return false;
    const run = getRun(runId);
    if (!run || record.runId && record.runId !== runId || record.importId && record.importId !== run.importId) return false;
    if (record.caseId && readCase(record.caseId)?.importId !== run.importId) return false;
    return recordAgentActivity({...record, runId, importId: run.importId});
  }).immediate();
}
export function getAgentActivity(caseId?: string): Record<string, unknown>[] { return (caseId ? sqlite.prepare("SELECT data FROM close_agent_activity WHERE case_id=? ORDER BY created_at DESC LIMIT 100").all(caseId) : sqlite.prepare("SELECT data FROM close_agent_activity ORDER BY created_at DESC LIMIT 100").all()).map(row => json<Record<string, unknown>>(row)!); }
