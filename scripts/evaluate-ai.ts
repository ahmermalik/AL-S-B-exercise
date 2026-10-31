import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { CaseDetail, Proposal } from "../src/shared/types";

type ProposalInput = Omit<Proposal, "id" | "version" | "createdAt" | "disposition">;
type EvaluationResult = {
  label: string;
  caseId: string;
  sourceRow: number | null;
  kind: string;
  amountCents: number;
  evidenceVersion: number;
  caseRevision: number;
  supportOrigin: unknown;
  expectedRoute: string;
  actual: ProposalInput | null;
  checks: Record<string, boolean>;
  activity: Record<string, unknown>[];
  elapsedMs: number;
  error: string | null;
};

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim() || !process.env.OPENAI_MODEL?.trim()) {
    throw new Error("Configure OPENAI_API_KEY and OPENAI_MODEL before running the live evaluation.");
  }
  const workbookPath = resolve(process.env.SOURCE_WORKBOOK_PATH || "data/source/close-pack.xlsx");
  const directory = resolve("data/ai-evaluations");
  mkdirSync(directory, {recursive: true});
  const runDirectory = mkdtempSync(join(directory, "run-"));
  // Set isolation before loading any database-owning module. Never touch the working DB.
  process.env.DATABASE_PATH = join(runDirectory, "evaluation.sqlite");
  const { initializeDatabase, sqlite, getDatabaseVersion } = await import("../src/server/db");
  const store = await import("../src/server/store");
  const { reviseCaseWithAi } = await import("../src/server/llm");
  initializeDatabase();
  try {
    const source = await store.importWorkbook(readFileSync(workbookPath), basename(workbookPath));
    store.prepareFindings(source.id);
    const all = store.listRunCases(source.id);
    const duplicate = all.find(c => c.propertyId === "P105" && c.kind === "duplicate" && c.title.includes("StaffBridge"));
    const grounds = all.find(c => c.propertyId === "P105" && c.kind === "coding" && c.title.includes("Lone Star Lawn"));
    const capital = all.find(c => c.kind === "coding" && Number((c.facts.invoice as {source?: {row?: number}})?.source?.row) === 309)
      || all.find(c => c.kind === "coding" && Number((c.facts.invoice as {source?: {row?: number}})?.source?.row) === 12);
    if (!duplicate || !grounds || !capital) throw new Error("The expected labelled source cases were not found in the supplied workbook.");
    const support = store.getSupportTemplate(grounds.id);
    if (!support) throw new Error("The grounds supporting-record fixture is unavailable.");
    const supportedGrounds = store.applyCaseAction(grounds.id, {
      action: "support", expectedRevision: grounds.revision, support,
    }, {id: "evaluation-accountant", name: "Evaluation recorder", role: "accountant"});
    const examples: {label: string; detail: CaseDetail; expectedRoute: string; journalLines: number; needsGap: boolean}[] = [
      {label: "Unsupported duplicate: request facts, no reversal JE", detail: duplicate, expectedRoute: "Evidence review", journalLines: 0, needsGap: true},
      {label: "Supported same-entity grounds reclassification", detail: supportedGrounds, expectedRoute: "Expense reclassification", journalLines: 2, needsGap: false},
      {label: "Capital-versus-expense treatment requires policy", detail: capital, expectedRoute: "Accounting treatment review", journalLines: 0, needsGap: true},
    ];
    const results: EvaluationResult[] = [];
    const startedAt = new Date().toISOString();
    const outputPath = join(runDirectory, "results.json");
    const save = () => writeFileSync(outputPath, JSON.stringify({
      startedAt, model: process.env.OPENAI_MODEL, provider: "openai-responses", sqlite: getDatabaseVersion(),
      database: process.env.DATABASE_PATH, source: {id: source.id, hash: source.hash, filename: source.filename},
      supplementalSupport: {caseId: grounds.id, origin: "prepared_fixture", scope: "This evaluation only; not original workbook evidence."},
      results,
      summary: {casesAttempted: results.length, agentInvocationsAllowed: 3, passedMechanicalChecks: results.filter(r => !r.error && Object.values(r.checks).every(Boolean)).length},
      qualitativeReview: {status: "pending", method: "Review the recorded wording separately for unsupported causal, posting/payment, accounting-treatment or savings claims. Mechanical checks are not a factual-accuracy score."},
    }, null, 2));
    for (const example of examples) {
      const baseline = store.buildRuleProposal(example.detail);
      const activity: Record<string, unknown>[] = [];
      const began = Date.now();
      const result: EvaluationResult = {
        label: example.label, caseId: example.detail.id, kind: example.detail.kind,
        sourceRow: Number((example.detail.facts.invoice as {source?: {row?: number}})?.source?.row) || null,
        amountCents: example.detail.amountCents, evidenceVersion: example.detail.evidenceVersion,
        caseRevision: example.detail.revision, supportOrigin: example.detail.facts.supportOrigin || "workbook_only",
        expectedRoute: example.expectedRoute, actual: null, checks: {}, activity, elapsedMs: 0, error: null,
      };
      try {
        // Exactly one bounded agent invocation per labelled example; no evaluation retries.
        const actual = await reviseCaseWithAi(example.detail, {
          onActivity(record) {
            activity.push(record);
            store.recordAgentActivity({caseId: example.detail.id, evaluation: true, ...record});
          },
        });
        const known = new Set(example.detail.evidence.map(e => e.id));
        result.actual = actual;
        result.checks = {
          routeMatchesLabel: actual.route === example.expectedRoute,
          journalMatchesAuthoritativeBaseline: JSON.stringify(actual.journal) === JSON.stringify(baseline.journal) && actual.journal.length === example.journalLines,
          missingFactsUnchanged: JSON.stringify(actual.missing) === JSON.stringify(baseline.missing),
          expectedGapState: example.needsGap ? actual.missing.length > 0 : actual.missing.length === 0,
          sourceReferencesInScope: actual.sources.length > 0 && actual.sources.every(id => known.has(id)),
          evidenceWasRead: activity.some(event => event.event === "evidence_tool" && event.tool === "get_case_evidence"),
          evidenceVersionBound: actual.evidenceVersion === example.detail.evidenceVersion,
          boundedEvidenceCalls: activity.filter(event => event.event === "evidence_tool").length <= 6,
          modelRecorded: activity.some(event => event.event === "model_response" && event.model === process.env.OPENAI_MODEL),
        };
        // Also exercise the normal authoritative commit guard, in the isolated DB only.
        const committed = store.saveAgentProposal(example.detail.id, example.detail.revision, actual);
        result.checks.commitRetainsEvidenceVersion = committed.evidenceVersion === example.detail.evidenceVersion;
      } catch (error) {
        result.error = error instanceof Error ? error.message : "Evaluation failed before a validated draft was available.";
      }
      result.elapsedMs = Date.now() - began;
      results.push(result); save();
      console.log(`${results.length}/3 ${result.error || !Object.values(result.checks).every(Boolean) ? "needs attention" : "mechanical checks passed"}: ${example.label}`);
    }
    save();
    console.log(`Evaluation output: ${outputPath}`);
    if (results.some(result => result.error || !Object.values(result.checks).every(Boolean))) process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Evaluation setup failed.");
  process.exitCode = 1;
});
