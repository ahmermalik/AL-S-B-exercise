import { createHash } from "node:crypto";
import type { Briefing, Operations } from "../shared/types";
import { BRIEFING_PROMPT_VERSION, draftBriefing, isAiConfigured, type AiOptions } from "./llm";
import { aiUsage, briefingInput, computeAttention, stageMatrix } from "./operations";
import { DomainError, latestBriefing, operationsSource, recordAgentActivity, saveBriefing } from "./store";

function currentInput(model = process.env.OPENAI_MODEL?.trim() || "unconfigured") {
  const { parsed, cases } = operationsSource();
  const matrix = stageMatrix(parsed), input = briefingInput(parsed, cases, computeAttention(parsed, cases), matrix);
  // Prompt or model changes also invalidate a cached briefing.
  const fingerprint = createHash("sha256").update(`${input.fingerprint}:${BRIEFING_PROMPT_VERSION}:${model}`).digest("hex");
  return { ...input, fingerprint, matrix, usage: aiUsage(cases) };
}

export function getOperations(): Operations {
  const input = currentInput(), current = latestBriefing(input.importId);
  return {
    matrix: input.matrix, usage: input.usage,
    briefing: { current, fingerprint: input.fingerprint, stale: !!current && current.fingerprint !== input.fingerprint },
    ai: { configured: isAiConfigured(), model: process.env.OPENAI_MODEL || null },
  };
}

const inflight = new Map<string, Promise<Briefing>>();
/** Returns the briefing for the current review state, drafting it once per state even when several managers ask at the same time. */
export function ensureBriefing(context: { actorId: string; generation: string }, options: Pick<AiOptions, "transport" | "model"> = {}): Promise<Briefing> {
  const input = currentInput(options.model);
  const cached = latestBriefing(input.importId);
  if (cached?.fingerprint === input.fingerprint) return Promise.resolve(cached);
  const key = `${context.generation}:${input.importId}:${input.fingerprint}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const work = (async () => {
    const result = await draftBriefing(input.facts, input.links, {
      ...options,
      onActivity: record => { recordAgentActivity({ ...record, importId: input.importId, resetGeneration: context.generation, actorId: context.actorId, fingerprint: input.fingerprint }); },
    });
    const used = [...new Set(result.items.flatMap(item => item.links))];
    const briefing = { importId: input.importId, fingerprint: input.fingerprint, items: result.items, links: Object.fromEntries(used.map(key => [key, input.links[key]])), model: result.model, promptVersion: result.promptVersion };
    if (!saveBriefing(briefing, context.generation)) throw new DomainError(409, "The workspace changed while the briefing was drafted. Reload and try again.");
    return latestBriefing(input.importId) || { ...briefing, createdAt: new Date().toISOString() };
  })().finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}
