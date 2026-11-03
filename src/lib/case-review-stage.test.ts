import { describe, expect, it } from "vitest";
import { caseReviewStage } from "./case-review-stage";
import type { Proposal } from "../shared/types";
const draft = (patch: Partial<Proposal> = {}): Proposal => ({id:"p",version:1,evidenceVersion:0,route:"Evidence review",summary:"Explanation",rationale:"Support",missing:[],sources:[],journal:[],origin:"rules",disposition:"pending",createdAt:"2026-11-02T00:00:00Z",...patch});
const item = (patch: Partial<Parameters<typeof caseReviewStage>[0]> = {}) => ({status:"candidate" as const,kind:"duplicate" as const,evidenceVersion:0,proposals:[draft()],...patch});
describe("case actions follow the current work stage", () => {
  it("keeps unsupported corrections out of manager approval", () => {
    expect(caseReviewStage(item({proposals:[draft({missing:["Invoice needed"]})]}))).toBe("needs_support");
    expect(caseReviewStage(item())).toBe("review");
  });
  it("allows variance wording review while keeping accepted wording's support open", () => {
    const variance=item({kind:"variance",proposals:[draft({missing:["Ledger needed"]})]});
    expect(caseReviewStage(variance)).toBe("review");
    variance.proposals[0].disposition="approved";
    expect(caseReviewStage(variance)).toBe("needs_support");
  });
  it("shows requested changes until a revised proposal is prepared", () => {
    expect(caseReviewStage(item({status:"awaiting_evidence",proposals:[draft({disposition:"returned"})]}))).toBe("changes_requested");
    expect(caseReviewStage(item({status:"awaiting_evidence",proposals:[draft({disposition:"returned"}),draft({id:"new",version:2})]}))).toBe("review");
  });
  it("requires a current recommendation before review", () => {
    expect(caseReviewStage(item({evidenceVersion:1}))).toBe("update_recommendation");
    expect(caseReviewStage(item({proposals:[]}))).toBe("update_recommendation");
  });
  it("keeps approval, execution checks, resolution and closure distinct", () => {
    expect(caseReviewStage(item({status:"approved"}))).toBe("approved");
    expect(caseReviewStage(item({status:"executed"}))).toBe("execution_check");
    expect(caseReviewStage(item({status:"verification_failed"}))).toBe("execution_check");
    expect(caseReviewStage(item({status:"verified"}))).toBe("resolve");
    expect(caseReviewStage(item({status:"resolved"}))).toBe("closed");
    expect(caseReviewStage(item({status:"dismissed"}))).toBe("closed");
  });
});
