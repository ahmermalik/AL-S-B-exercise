import { describe, expect, it } from "vitest";
import { caseReviewActivity } from "./case-review-activity";
import type { CaseDetail, Proposal } from "../shared/types";
const draft = (patch: Partial<Proposal> = {}): Proposal => ({id:"p",version:2,evidenceVersion:1,route:"AP reversal",summary:"",rationale:"",missing:[],sources:[],journal:[],origin:"rules",disposition:"approved",createdAt:"2026-11-03T14:29:00Z",...patch});
function item(): Pick<CaseDetail, "evidence" | "evidenceVersion" | "proposals" | "history"> {
  return {evidenceVersion:1,proposals:[draft()],evidence:[{id:"e",label:"Invoice",kind:"invoice",author:"Source author",text:"",version:1,createdAt:"2026-11-03T14:29:00Z",data:{recordedBy:{id:"staff",name:"P. Okafor"}}}],history:[{id:"h",actor:"Sandy Tran-Li",at:"2026-11-03T14:30:00Z",action:"Approved proposal v2 / E1; execution is separate."}]};
}
describe("case handoff attribution",()=>{
  it("shows the submitting account rather than the document author and the current approver",()=>{
    expect(caseReviewActivity(item())).toEqual({support:{name:"P. Okafor",at:"2026-11-03T14:29:00Z"},approval:{name:"Sandy Tran-Li",at:"2026-11-03T14:30:00Z"}});
  });
  it("does not treat a previous approval or an older support submission as current",()=>{
    const c=item();c.evidenceVersion=2;c.proposals.push(draft({id:"new",version:3,evidenceVersion:2,disposition:"pending"}));
    expect(caseReviewActivity(c)).toEqual({support:null,approval:null});
  });
  it("uses existing support history when legacy evidence lacks recordedBy",()=>{
    const c=item();delete c.evidence[0].data;c.history.push({id:"s",actor:"P. Okafor",at:"2026-11-03T14:29:00Z",action:"Recorded support from Source author as E1 and prepared proposal v2 from current evidence; earlier review is historical."});
    expect(caseReviewActivity(c).support?.name).toBe("P. Okafor");
  });
  it("distinguishes accepted variance wording and matches the whole proposal number",()=>{
    const c=item();c.proposals=[draft({version:20})];expect(caseReviewActivity(c).approval).toBeNull();
    c.proposals=[draft()];c.history[0].action="Approved proposal v2 / E1 wording; remaining support stays open.";
    expect(caseReviewActivity(c).approval?.name).toBe("Sandy Tran-Li");
  });
});
