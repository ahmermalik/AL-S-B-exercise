import { z } from "zod";
import type { BriefingItem } from "../shared/types";
import type { briefingInput } from "./operations";

export type BriefingFacts = ReturnType<typeof briefingInput>["facts"];
type Topic = "commentary" | "threshold" | "overdue" | "amounts" | "followup";
type Fact = { id: string; text: string; links: string[]; topic: Topic; scope?: string };
type Action = { text: string; topics: Topic[]; requiredTopics?: Topic[]; sameScope?: boolean };
export interface BriefingCatalog { facts: Fact[]; actions: Record<string, Action> }

const actions: Record<string, Action> = {
  "locate-commentary": { text: "Confirm where the commentary was recorded, or reopen the step and request an explanation.", topics: ["commentary"] },
  "confirm-threshold": { text: "Confirm the threshold review before completing the tracker step.", topics: ["threshold"] },
  "reconcile-commentary": { text: "Confirm commentary locations and threshold reviews before updating tracker completion.", topics: ["commentary", "threshold"], requiredTopics: ["commentary", "threshold"] },
  "review-commentary-evidence": { text: "Review current evidence requirements and complete the remaining review before resolving the issue.", topics: ["commentary"] },
  "confirm-recovery": { text: "Confirm blockers and agree recovery owners and checkpoints with the responsible accountant.", topics: ["overdue"], sameScope: true },
  "review-coverage": { text: "Discuss recovery priorities and confirm whether temporary coverage is needed.", topics: ["overdue"], sameScope: true },
  "check-stage-blockers": { text: "Ask the responsible accountants to confirm shared blockers and the next checkpoint.", topics: ["overdue"], sameScope: true },
  "verify-amounts": { text: "Request invoice support to verify the amounts; these flags establish neither an error nor a payment hold.", topics: ["amounts"] },
  "review-followup": { text: "Review the affected properties and confirm the next owner and checkpoint.", topics: ["followup"] },
  "review-remaining-close": { text: "Review remaining tracker steps before the owner-report handoff; this does not certify close readiness.", topics: ["followup"] },
};

/** Code owns every displayed claim and its links. The model only selects priorities and compatible next steps. */
export function buildBriefingCatalog(facts: BriefingFacts, links: Record<string, string>): BriefingCatalog {
  const result: Fact[] = [];
  function add(fact: Fact) {
    if (fact.links.length && fact.links.every(key => Object.hasOwn(links, key))) result.push(fact);
  }
  const n = facts.commentary.awaitingAcceptedWording;
  if (n) add({ id: "commentary:wording", text: `${n} properties marked Complete still need required commentary wording reviewed.`, links: ["commentary"], topic: "commentary", scope: "wording" });
  const accepted = facts.commentary.markedCompleteWithoutRequiredCommentary.filter(p => p.categories.some(c => c.reviewState === "Wording accepted; support outstanding")).length;
  if (accepted) add({ id: "commentary:accepted", text: `Commentary wording is accepted at ${accepted} ${accepted === 1 ? "property" : "properties"}; final issue resolution is not recorded.`, links: ["commentary"], topic: "commentary", scope: "accepted" });
  const threshold = facts.commentary.thresholdReviewsDue.count;
  if (threshold) add({ id: "commentary:threshold", text: `${threshold} properties need threshold confirmation, with no category above ${facts.commentaryThresholdPercent}%.`, links: ["threshold"], topic: "threshold" });
  for (const p of facts.overdueSteps.byAccountantPortfolio) {
    const scope = `portfolio:${p.accountant}`;
    add({ id: scope, text: `${p.accountant}'s portfolio has ${p.overdue} of ${facts.overdueSteps.total} tracker-reported overdue steps.`, links: [`accountant:${p.accountant}`], topic: "overdue", scope });
    for (const property of p.openPropertiesByOverdueSteps) add({ id: `property:${property.propertyId}:overdue`, text: `${property.property} has ${property.overdueSteps} tracker-reported overdue ${property.overdueSteps === 1 ? "step" : "steps"}.`, links: [`property:${property.propertyId}`], topic: "overdue", scope });
  }
  for (const s of facts.overdueSteps.byStage) add({ id: `stage:${s.stage}`, text: `${s.overdue} of ${s.due} ${s.stage} steps are tracker-reported overdue.`, links: [`stage:${s.stage}`], topic: "overdue", scope: `stage:${s.stage}` });
  const outside = facts.overdueSteps.outsideLargestPortfolio;
  if (outside?.overdue) {
    const stages = Object.entries(outside.byStage);
    const onlyStage = stages.length === 1 ? stages[0][0] : null;
    add({ id: "overdue:outside-largest", text: `Outside ${outside.excludes}'s portfolio, ${outside.overdue} tracker-reported steps are overdue${onlyStage ? `, all in ${onlyStage}` : ""}.`, links: onlyStage ? [`stage:${onlyStage}`] : ["overdue"], topic: "overdue", scope: "outside-largest" });
  }
  const amounts = facts.amountVerification;
  if (amounts.pendingApproval) add({ id: "amounts:pending", text: `${amounts.pendingApproval} amount-verification flags are marked Pending in the register, totaling ${amounts.pendingAmount}.`, links: ["amounts"], topic: "amounts" });
  else if (amounts.flaggedInvoices) add({ id: "amounts:all", text: `${amounts.flaggedInvoices} invoices totaling ${amounts.flaggedAmount} are flagged for amount verification.`, links: ["amounts"], topic: "amounts" });
  add({ id: "followup:properties", text: facts.followUp.properties ? `${facts.followUp.properties} properties need follow-up for overdue steps or required commentary.` : "The implemented checks identify no open overdue-step or required-commentary follow-up.", links: ["followup"], topic: "followup", scope: facts.followUp.properties ? "open" : "none" });
  return { facts: result, actions };
}

export function briefingSelectionSchema(catalog: BriefingCatalog) {
  const factIds = catalog.facts.map(f => f.id) as [string, ...string[]];
  const actionIds = Object.keys(catalog.actions) as [string, ...string[]];
  return z.object({ items: z.array(z.object({ factIds: z.array(z.enum(factIds)).min(1).max(2), actionId: z.enum(actionIds) }).strict()).min(1).max(3) }).strict();
}
export type BriefingSelection = { items: { factIds: string[]; actionId: string }[] };
const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

export function renderBriefingSelection(value: unknown, catalog: BriefingCatalog): { items: BriefingItem[]; selection: BriefingSelection; issue: null } | { issue: string } {
  if (!catalog.facts.length) return { issue: "No supported facts with valid work links are available." };
  const parsed = briefingSelectionSchema(catalog).safeParse(value);
  if (!parsed.success) return { issue: "Select only supplied factIds and actionId values; do not add wording, counts, names or links." };
  const seen = new Set<string>(), items: BriefingItem[] = [];
  for (const item of parsed.data.items) {
    const selected = item.factIds.map(id => catalog.facts.find(f => f.id === id)!);
    if (selected.some(f => seen.has(f.id)) || new Set(item.factIds).size !== item.factIds.length) return { issue: "Use each fact only once in the briefing." };
    selected.forEach(f => seen.add(f.id));
    const action = catalog.actions[item.actionId];
    if (selected.some(f => !action.topics.includes(f.topic)) || action.requiredTopics?.some(topic => !selected.some(f => f.topic === topic))) return { issue: "Choose an action compatible with all selected facts." };
    if (action.sameScope && new Set(selected.map(f => f.scope)).size !== 1) return { issue: "Keep each recovery action within the same portfolio or stage." };
    if (item.actionId === "review-commentary-evidence" && selected.some(f => f.scope !== "accepted")) return { issue: "Review remaining requirements only for accepted-wording facts." };
    if (item.actionId === "locate-commentary" && selected.some(f => f.scope !== "wording")) return { issue: "Locate commentary only for facts awaiting wording review." };
    if (item.actionId === "reconcile-commentary" && selected.some(f => f.scope === "accepted")) return { issue: "Reconcile threshold reviews with commentary awaiting wording, not accepted-wording facts." };
    if (item.actionId === "review-remaining-close" && selected.some(f => f.scope !== "none")) return { issue: "Review remaining close work only when the follow-up check has no open properties." };
    if (item.actionId === "review-followup" && selected.some(f => f.scope !== "open")) return { issue: "Review affected properties only when open follow-up exists." };
    const text = [...selected.map(f => f.text), action.text].join(" ");
    if (words(text) > 45) return { issue: "Select fewer facts so each rendered item stays within 45 words." };
    items.push({ text, links: [...new Set(selected.flatMap(f => f.links))] });
  }
  if (items.reduce((n, item) => n + words(item.text), 0) > 120) return { issue: "Select fewer facts so the rendered briefing stays within 120 words." };
  return { items, selection: parsed.data, issue: null };
}
