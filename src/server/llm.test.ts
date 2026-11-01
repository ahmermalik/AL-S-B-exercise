import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CaseDetail } from "../shared/types";
import { AiOutputError, AiUnavailableError, briefingIssue, draftBriefing, draftSummary, isAiConfigured, reviseCaseWithAi, type ProposalInput, type ResponsesTransport } from "./llm";
import { buildBriefingCatalog, renderBriefingSelection } from "./briefing-grounding";
import { parseWorkbook, type ParsedWorkbook } from "./import";
import { findCases } from "./domain";
import { briefingInput } from "./operations";

type StubResponse = Awaited<ReturnType<ResponsesTransport["create"]>>;
function response(text: string, output: StubResponse["output"] = []): StubResponse {
  return { id: "response-1", status: "completed", output_text: text, output, usage: undefined };
}
const sourceCall = (caseId = "case-1", name = "get_case_evidence") => ({
  type: "function_call" as const, id: "fc-1", call_id: "call-1", name,
  arguments: JSON.stringify({ caseId, evidenceIds: ["source-1"] }),
});
function detail(): CaseDetail {
  return {
    id: "case-1", importId: "import-1", propertyId: "P105", propertyName: "Sunset Ridge", kind: "coding",
    title: "Grounds coding", amountCents: 221416, status: "candidate", revision: 1, evidenceVersion: 0,
    nextAction: "Obtain support", owner: "Accountant", facts: { amountCents: 221416 },
    evidence: [{ id: "source-1", label: "Invoice row", kind: "workbook", author: "Workbook", text: "Monthly grounds maintenance $2,214.16", version: 0, createdAt: "2026-10-31" }],
    proposals: [], requests: [], execution: null, history: [],
  };
}
const baseline: ProposalInput = {
  evidenceVersion: 0, route: "request_evidence", summary: "Grounds coded to Electric.", rationale: "Invoice and posting support required.",
  missing: ["Posting and payment state"], sources: ["source-1"], journal: [], origin: "rules",
};
const draft = { summary: "Grounds maintenance is $2,214.16; posting support is outstanding.", rationale: "The description suggests Landscaping; verify the invoice and ledger.", sources: ["source-1"] };

afterEach(() => { vi.unstubAllEnvs(); });

describe("bounded case evidence drafting", () => {
  it("requires both provider credentials and model and never returns an AI fixture", async () => {
    vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("OPENAI_MODEL", "");
    expect(isAiConfigured()).toBe(false);
    await expect(reviseCaseWithAi(detail(), { baseline })).rejects.toBeInstanceOf(AiUnavailableError);
    vi.stubEnv("OPENAI_API_KEY", "configured"); expect(isAiConfigured()).toBe(false);
  });

  it("reads only scoped evidence and preserves code-owned route, journal and prerequisites", async () => {
    const create = vi.fn<ResponsesTransport["create"]>()
      .mockResolvedValueOnce(response("", [sourceCall()]))
      .mockResolvedValueOnce(response(JSON.stringify(draft)));
    const activity: Record<string, unknown>[] = [];
    const result = await reviseCaseWithAi(detail(), { transport: { create }, baseline, onActivity: e => activity.push(e) });
    expect(result).toMatchObject({ ...draft, origin: "ai", route: baseline.route, journal: [], missing: baseline.missing, evidenceVersion: 0 });
    const input = create.mock.calls[1][0].input;
    expect(input).toEqual(expect.arrayContaining([expect.objectContaining({ type: "function_call_output", call_id: "call-1" })]));
    expect(activity.some(e => e.event === "evidence_tool")).toBe(true);
    expect(JSON.stringify(activity)).not.toContain("api_key");
  });

  it("rejects cross-case tool access", async () => {
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response("", [sourceCall("another-case")]));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.toThrow("outside this case");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown tools rather than execute arbitrary capabilities", async () => {
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response("", [sourceCall("case-1", "execute_sql")]));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.toThrow("unsupported tool");
  });

  it("allows only one source/schema repair and rejects an invented source", async () => {
    const bad = { ...draft, sources: ["invented-source"] };
    const create = vi.fn<ResponsesTransport["create"]>()
      .mockResolvedValueOnce(response("", [sourceCall()]))
      .mockResolvedValue(response(JSON.stringify(bad)));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("rejects unsupported currency after a bounded repair", async () => {
    const create = vi.fn<ResponsesTransport["create"]>()
      .mockResolvedValueOnce(response("", [sourceCall()]))
      .mockResolvedValue(response(JSON.stringify({ ...draft, summary: "The amount is $999,999." })));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.toThrow("source and schema checks");
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("enforces the six-tool budget", async () => {
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response("", Array.from({ length: 7 }, (_, i) => ({ ...sourceCall(), id: `fc-${i}`, call_id: `call-${i}` }))));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.toThrow("evidence-call limit");
  });

  it("honors cancellation and sanitizes provider errors", async () => {
    const controller = new AbortController(); controller.abort();
    const create = vi.fn<ResponsesTransport["create"]>();
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline, signal: controller.signal })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    create.mockRejectedValue(new Error("sensitive provider body"));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.not.toThrow("sensitive provider body");
  });

  it("explains an exhausted credit balance without leaking provider bodies or changing the draft", async () => {
    const c = detail(), before = structuredClone(c), events: Record<string, unknown>[] = [];
    const providerError = Object.assign(new Error("raw provider body sk-secret-value"), { status: 429, code: "credit_balance_exhausted", type: "insufficient_quota", headers: { authorization: "Bearer sk-secret-value" } });
    const create = vi.fn<ResponsesTransport["create"]>().mockRejectedValue(providerError);
    await expect(reviseCaseWithAi(c, { transport: { create }, baseline, onActivity: event => events.push(event) })).rejects.toThrow("AI credit limit reached");
    expect(c).toEqual(before); expect(create).toHaveBeenCalledTimes(1);
    expect(events).toEqual([expect.objectContaining({ event: "provider_error", status: 429, code: "credit_balance_exhausted", errorType: "Error" })]);
    expect(JSON.stringify(events)).not.toMatch(/secret|authorization|headers|raw provider body/);
  });

  it.each([
    [{ status: 401, code: "invalid_api_key" }, "credentials were rejected"],
    [{ status: 404, code: "model_not_found" }, "model is unavailable"],
    [{ status: 429, code: "project_spend_limit_exceeded", type: "insufficient_quota" }, "account limit reached"],
  ])("maps known provider configuration errors to actionable messages", async (metadata, message) => {
    const create = vi.fn<ResponsesTransport["create"]>().mockRejectedValue(Object.assign(new Error("private provider detail"), metadata));
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline })).rejects.toThrow(message);
  });

  it("does not log unknown error names or provider codes", async () => {
    const events: Record<string, unknown>[] = [];
    const error = Object.assign(new Error("private body"), { status: 500, code: "secret_provider_payload", name: "secret_provider_name" });
    const create = vi.fn<ResponsesTransport["create"]>().mockRejectedValue(error);
    await expect(reviseCaseWithAi(detail(), { transport: { create }, baseline, onActivity: event => events.push(event) })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(events[0]).toMatchObject({ status: 500, code: "unknown", errorType: "ProviderError" });
    expect(JSON.stringify(events)).not.toContain("secret");
  });
});

describe("package summary boundary", () => {
  it("provides human status wording to the summary model", async () => {
    const c = detail(); c.status = "awaiting_evidence";
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify({ summary: "Staff must obtain the missing posting support before manager review.", caseIds: [c.id] })));
    await draftSummary([c], { transport: { create } });
    const input = String(create.mock.calls[0][0].input);
    expect(input).toContain("Awaiting evidence"); expect(input).not.toContain("awaiting_evidence");
  });
  it("rejects a handoff over 60 words rather than silently truncate its meaning", async () => {
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify({ summary: Array.from({ length: 61 }, () => "word").join(" "), caseIds: ["case-1"] })));
    await expect(draftSummary([detail()], { transport: { create } })).rejects.toThrow("60-word");
  });
  it("rejects internal status identifiers in displayed handoff wording", async () => {
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify({ summary: "The case is awaiting_evidence.", caseIds: ["case-1"] })));
    await expect(draftSummary([detail()], { transport: { create } })).rejects.toThrow("internal status");
  });
  it("rejects source cases outside the supplied package", async () => {
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify({ summary: "Review the missing support.", caseIds: ["outside"] })));
    await expect(draftSummary([detail()], { transport: { create } })).rejects.toThrow("outside this package");
  });
  it("returns concise validated text without changing any case state", async () => {
    const c = detail(), before = structuredClone(c);
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify({ summary: "Staff must verify the posting support before a correction is approved.", caseIds: [c.id] })));
    await expect(draftSummary([c], { transport: { create } })).resolves.toContain("posting support");
    expect(c).toEqual(before);
  });
});

describe("priorities briefing boundary", () => {
  let parsed: ParsedWorkbook, cases: CaseDetail[], input: ReturnType<typeof briefingInput>;
  beforeAll(async () => {
    parsed = await parseWorkbook(readFileSync("seed/close-pack.xlsx"), "close-pack.xlsx");
    cases = findCases(parsed);
    input = briefingInput(parsed, cases);
  });
  const valid = { items: [
    { factIds: ["commentary:wording", "commentary:threshold"], actionId: "reconcile-commentary" },
    { factIds: ["portfolio:J. Ramirez", "property:P104:overdue"], actionId: "confirm-recovery" },
    { factIds: ["amounts:pending"], actionId: "verify-amounts" },
  ] };
  it("renders selected workbook facts, exact relational counts and their bound work links", async () => {
    expect(briefingIssue(valid, input.facts, input.links)).toBeNull();
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify(valid)));
    const activity: Record<string, unknown>[] = [];
    const result = await draftBriefing(input.facts, input.links, { transport: { create }, onActivity: event => activity.push(event) });
    expect(result.items).toHaveLength(3); expect(create).toHaveBeenCalledTimes(1);
    expect(result.items[0]).toMatchObject({ text: expect.stringContaining("6 properties marked Complete"), links: ["commentary", "threshold"] });
    expect(result.items[0].text).toContain("9 properties need threshold confirmation");
    expect(result.items[1]).toEqual({ text: "J. Ramirez's portfolio has 31 of 36 tracker-reported overdue steps. The Grove at Kingwood has 5 tracker-reported overdue steps. Confirm blockers and agree recovery owners and checkpoints with the responsible accountant.", links: ["accountant:J. Ramirez", "property:P104"] });
    expect(result.items[2].text).toContain("6 amount-verification flags are marked Pending in the register, totaling $159,233.84");
    expect(result.items.every(item => item.text.split(/\s+/).length <= 45)).toBe(true);
    expect(result.items.flatMap(item => item.text.split(/\s+/)).length).toBeLessThanOrEqual(120);
    expect(activity).toContainEqual(expect.objectContaining({ event: "briefing_selection", selection: valid }));
    expect(String(create.mock.calls[0][0].instructions)).toContain("not a judgment about a person");
    const schema = create.mock.calls[0][0].text?.format;
    expect(JSON.stringify(schema)).toContain("portfolio:J. Ramirez");
    expect(JSON.stringify(schema)).not.toContain('"text"');
  });
  it.each([
    { items: [{ text: "Recover 104 overdue steps before BD8.", links: ["overdue"] }] },
    { items: [{ factIds: ["portfolio:J. Ramirez"], actionId: "confirm-recovery", text: "J. Ramirez owns 36 overdue steps." }] },
    { items: [{ factIds: ["portfolio:J. Ramirez"], actionId: "confirm-recovery", text: "Ask Morgan Patel at Fake Heights." }] },
    { items: [{ factIds: ["portfolio:Morgan Patel"], actionId: "confirm-recovery" }] },
    { items: [{ factIds: ["property:Fake Heights:overdue"], actionId: "confirm-recovery" }] },
    { items: [{ factIds: ["amounts:pending"], actionId: "pay-invoices" }] },
    { items: [{ factIds: ["amounts:pending"], actionId: "verify-amounts", links: ["accountant:J. Ramirez"] }] },
  ])("rejects model-authored claims, invented identities, unknown selections and link overrides", draft => {
    expect(briefingIssue(draft, input.facts, input.links)).toContain("Select only supplied");
  });
  it.each([
    [{ items: [{ factIds: ["portfolio:J. Ramirez"], actionId: "verify-amounts" }] }, "compatible"],
    [{ items: [{ factIds: ["portfolio:J. Ramirez", "property:P125:overdue"], actionId: "confirm-recovery" }] }, "same portfolio or stage"],
    [{ items: [{ factIds: ["portfolio:J. Ramirez", "stage:Bank reconciliation"], actionId: "confirm-recovery" }] }, "same portfolio or stage"],
    [{ items: [{ factIds: ["commentary:wording"], actionId: "review-commentary-evidence" }] }, "accepted-wording"],
    [{ items: [{ factIds: ["commentary:threshold"], actionId: "reconcile-commentary" }] }, "compatible"],
    [{ items: [valid.items[1], valid.items[1]] }, "only once"],
  ])("rejects incompatible actions, cross-portfolio recovery claims and repeated facts", (draft, message) => {
    expect(briefingIssue(draft, input.facts, input.links)).toContain(message);
  });
  it("uses current wording disposition while preserving the imported tracker count", () => {
    const reviewed = structuredClone(cases);
    reviewed.find(c => c.kind === "variance" && c.propertyId === "P114")!.proposals.at(-1)!.disposition = "approved";
    reviewed.find(c => c.kind === "close" && c.propertyId === "P104")!.status = "dismissed";
    const current = briefingInput(parsed, reviewed), catalog = buildBriefingCatalog(current.facts, current.links);
    expect(catalog.facts.find(f => f.id === "commentary:wording")!.text).toContain("5 properties");
    expect(catalog.facts.find(f => f.id === "commentary:accepted")!.text).toContain("1 property; final issue resolution is not recorded");
    expect(catalog.facts.find(f => f.id === "portfolio:J. Ramirez")!.text).toContain("31 of 36 tracker-reported overdue steps");
    expect(catalog.facts.find(f => f.id === "property:P104:overdue")).toBeUndefined();
    expect(briefingIssue({ items: [{ factIds: ["commentary:accepted"], actionId: "review-commentary-evidence" }] }, current.facts, current.links)).toBeNull();
    expect(briefingIssue({ items: [{ factIds: ["commentary:accepted"], actionId: "locate-commentary" }] }, current.facts, current.links)).toContain("awaiting wording");
  });
  it("does not invent missing support when wording is accepted and all evidence requirements are satisfied", () => {
    const reviewed = structuredClone(cases), c = reviewed.find(c => c.kind === "variance" && c.propertyId === "P114")!;
    c.status = "verified";
    c.proposals.at(-1)!.disposition = "approved";
    c.proposals.at(-1)!.missing = [];
    const current = briefingInput(parsed, reviewed), catalog = buildBriefingCatalog(current.facts, current.links);
    const result = renderBriefingSelection({ items: [{ factIds: ["commentary:accepted"], actionId: "review-commentary-evidence" }] }, catalog);
    expect(result).toMatchObject({ issue: null, items: [{ text: expect.stringContaining("final issue resolution is not recorded") }] });
    if ("items" in result) expect(result.items[0].text).not.toContain("supporting evidence remains outstanding");
  });
  it("handles a quiet snapshot without inventing an intervention and refuses a catalog without work links", async () => {
    const quiet = structuredClone(input.facts);
    quiet.followUp = { properties: 0, withOpenOverdueSteps: 0, withRequiredCommentaryOutstanding: 0, withBoth: 0 };
    quiet.overdueSteps = { ...quiet.overdueSteps, total: 0, byStage: [], byAccountantPortfolio: [], outsideLargestPortfolio: null };
    quiet.commentary = { ...quiet.commentary, awaitingAcceptedWording: 0, markedCompleteWithoutRequiredCommentary: [], thresholdReviewsDue: { count: 0, note: "" }, completionDateConflicts: 0 };
    quiet.amountVerification = { ...quiet.amountVerification, flaggedInvoices: 0, pendingApproval: 0 };
    const catalog = buildBriefingCatalog(quiet, input.links);
    const result = renderBriefingSelection({ items: [{ factIds: ["followup:properties"], actionId: "review-remaining-close" }] }, catalog);
    expect(result).toMatchObject({ issue: null, items: [{ text: expect.stringContaining("no open overdue-step or required-commentary follow-up"), links: ["followup"] }] });
    expect(briefingIssue({ items: [{ factIds: ["followup:properties"], actionId: "review-followup" }] }, quiet, input.links)).toContain("only when open");
    const create = vi.fn<ResponsesTransport["create"]>();
    await expect(draftBriefing(quiet, {}, { transport: { create } })).rejects.toThrow("No supported briefing facts");
    expect(create).not.toHaveBeenCalled();
  });
  it("allows one repair, then refuses rather than show an unsupported briefing", async () => {
    const bad = { items: [{ factIds: ["portfolio:J. Ramirez"], actionId: "verify-amounts" }] };
    const repaired = vi.fn<ResponsesTransport["create"]>().mockResolvedValueOnce(response(JSON.stringify(bad))).mockResolvedValueOnce(response(JSON.stringify(valid)));
    await expect(draftBriefing(input.facts, input.links, { transport: { create: repaired } })).resolves.toMatchObject({ items: expect.any(Array) });
    expect(repaired).toHaveBeenCalledTimes(2);
    expect(String(JSON.stringify(repaired.mock.calls[1][0].input))).toContain("compatible with all selected facts");
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify(bad)));
    await expect(draftBriefing(input.facts, input.links, { transport: { create } })).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("variance drafting context", () => {
  it("asks for invoice observations as questions rather than causes", async () => {
    const c = { ...detail(), kind: "variance" as const };
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValueOnce(response("", [sourceCall()])).mockResolvedValueOnce(response(JSON.stringify(draft)));
    await reviseCaseWithAi(c, { transport: { create }, baseline });
    const content = String((create.mock.calls[0][0].input as { content?: string }[])[0].content);
    expect(content).toContain("never state them as the cause");
  });
});
