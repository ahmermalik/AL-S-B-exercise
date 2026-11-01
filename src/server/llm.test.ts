import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaseDetail } from "../shared/types";
import { AiOutputError, AiUnavailableError, briefingIssue, draftBriefing, draftSummary, isAiConfigured, reviseCaseWithAi, type ProposalInput, type ResponsesTransport } from "./llm";

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
  const facts = { asOfBD: 6, ownerReportDueBD: 8, overdueSteps: { total: 36, byAccountantPortfolio: [{ accountant: "J. Ramirez", overdue: 31, overduePercent: 69, openPropertiesByOverdueSteps: [{ property: "The Grove at Kingwood", overdueSteps: 5 }] }] }, commentary: { awaitingAcceptedWording: 6, thresholdReviewsDue: { count: 9 } }, amountVerification: { pendingAmount: "$159,233.84" } };
  const links = { commentary: "Variance commentary cases", "accountant:J. Ramirez": "J. Ramirez portfolio", "property:P104": "The Grove at Kingwood" };
  const valid = { items: [
    { text: "Confirm where commentary for the 6 Complete steps was written, or reopen them before BD8; the 9 steps due today need threshold confirmation only.", links: ["commentary"] },
    { text: "Review recovery of 31 of 36 overdue steps with J. Ramirez, starting with The Grove at Kingwood (five steps).", links: ["accountant:J. Ramirez", "property:P104"] },
  ] };
  it("accepts a briefing whose numbers, people and links all come from the supplied facts", async () => {
    expect(briefingIssue(valid, facts, links)).toBeNull();
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify(valid)));
    const result = await draftBriefing(facts, links, { transport: { create } });
    expect(result.items).toHaveLength(2); expect(create).toHaveBeenCalledTimes(1);
    expect(String(create.mock.calls[0][0].instructions)).toContain("not a judgment about a person");
  });
  it.each([
    [{ items: [{ text: "Recover 40 overdue steps first.", links: ["commentary"] }] }, "number 40"],
    [{ items: [{ text: "Escalate to K. Patel today.", links: ["commentary"] }] }, "not a person"],
    [{ items: [{ text: "Review the commentary cases.", links: ["stage:Payroll allocation"] }] }, "link keys"],
    [{ items: [{ text: "Verify the $159K of flagged invoices.", links: ["commentary"] }] }, "exactly as supplied"],
    [{ items: [{ text: "Verify $1,000,000 of flagged invoices.", links: ["commentary"] }] }, "not in the supplied facts"],
    [{ items: [{ text: "I recommend reviewing commentary first.", links: ["commentary"] }] }, "first person"],
    [{ items: [{ text: "Review cases in awaiting_evidence status.", links: ["commentary"] }] }, "system field"],
  ])("rejects unsupported briefing content", (draft, message) => { expect(briefingIssue(draft, facts, links)).toContain(message); });
  it("allows one repair, then refuses rather than show an unsupported briefing", async () => {
    const bad = { items: [{ text: "Recover 40 overdue steps first.", links: ["commentary"] }] };
    const repaired = vi.fn<ResponsesTransport["create"]>().mockResolvedValueOnce(response(JSON.stringify(bad))).mockResolvedValueOnce(response(JSON.stringify(valid)));
    await expect(draftBriefing(facts, links, { transport: { create: repaired } })).resolves.toMatchObject({ items: valid.items });
    expect(String(JSON.stringify(repaired.mock.calls[1][0].input))).toContain("number 40");
    const create = vi.fn<ResponsesTransport["create"]>().mockResolvedValue(response(JSON.stringify(bad)));
    await expect(draftBriefing(facts, links, { transport: { create } })).rejects.toBeInstanceOf(AiOutputError);
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
