import { describe, expect, it } from "vitest";
import { caseEvidence } from "./case-evidence";
import type { CaseDetail, Evidence } from "../shared/types";
const record = (id: string, version: number, kind = "ledger"): Evidence => ({id,version,kind,label:id,author:"Source",text:"",createdAt:"2026-11-03T10:00:00Z"});
const execution: NonNullable<CaseDetail["execution"]> = {reference:"new-execution",evidenceVersion:2,amountCents:100,targetId:"tx",notes:"",proposalId:"p",at:"2026-11-03T10:00:00Z",verified:true};
const item = () => ({evidenceVersion:2,execution,evidence:[record("workbook",0,"workbook"),record("old-support",1),record("current-support",2),record("old-execution",2,"execution"),record("new-execution",2,"execution")]});
describe("supporting record groups",()=>{
  it("shows current support and latest execution without repeating earlier submissions",()=>{
    const groups=caseEvidence(item());
    expect(groups.original.map(r=>r.id)).toEqual(["workbook"]);
    expect(groups.support.map(r=>r.id)).toEqual(["current-support"]);
    expect(groups.execution.map(r=>r.id)).toEqual(["new-execution"]);
    expect(groups.history.flat().map(r=>r.id)).toEqual(["old-execution","old-support"]);
  });
  it("shows evidence for an older selected recommendation without presenting a newer correction as its result",()=>{
    const groups=caseEvidence(item(),1);
    expect(groups.support.map(r=>r.id)).toEqual(["old-support"]);
    expect(groups.execution).toEqual([]);
    expect(groups.history.flat().map(r=>r.id)).toContain("current-support");
  });
  it("keeps old execution records in history after new support reopens a case",()=>{
    const c=item();const groups=caseEvidence({...c,execution:null});
    expect(groups.execution).toEqual([]);
    expect(groups.history.flat().filter(r=>r.kind==="execution")).toHaveLength(2);
  });
});
