import {describe,expect,it} from "vitest";
import {duplicateReviewSummary} from "./duplicate-review-summary";
import type {CaseDetail,SupportInput} from "../shared/types";
const support: SupportInput={author:"P. Okafor",period:"September 2026",explanation:"One invoice entered twice.",invoiceReference:"INV-88241",transactionId:"SR-LAB-02",retainedTransactionId:"SR-LAB-01",entity:"OWNER-P105",postingState:"posted",paymentState:"unpaid",duplicateConfirmed:true,periodOpen:true,correctionAuthorized:true,invoiceRecord:"Invoice",ledgerRecord:"Ledger",paymentRecord:"Payment register",policyRecord:"Authority"};
function item():CaseDetail{return{id:"c",importId:"i",propertyId:"P105",propertyName:"Sunset Ridge",kind:"duplicate",title:"StaffBridge",amountCents:501779,status:"ready",revision:2,evidenceVersion:1,nextAction:"Review",owner:"P. Okafor",facts:{support},evidence:[],requests:[],history:[],execution:null,proposals:[{id:"p",version:2,evidenceVersion:1,route:"AP reversal",summary:"Reverse extra bill.",rationale:"",missing:[],sources:[],journal:[],origin:"rules",disposition:"pending",createdAt:"2026-11-03T10:00:00Z"}]};}
function executed(status:CaseDetail["status"],verified:boolean){const c=item();c.status=status;c.proposals[0].disposition="approved";c.execution={reference:"SAMPLE-CORRECTION",targetId:support.transactionId,amountCents:c.amountCents,notes:"Sample",evidenceVersion:1,proposalId:"p",at:"2026-11-03T11:00:00Z",verified};return c;}
describe("duplicate conclusion and correction",()=>{
 it("explains the actual duplicate and does not call support or approval a correction",()=>{
  const c=item();const before=duplicateReviewSummary(c)!;
  expect(before.finding.detail).toContain("SR-LAB-01 is the valid bill; SR-LAB-02 is the extra entry");
  expect(before.correction.title).toBe("No correction recorded");
  c.status="approved";expect(duplicateReviewSummary(c)!.correction.title).toBe("Approved; correction not yet recorded");
 });
 it("keeps candidates and incomplete support unconfirmed",()=>{
  const c=item();c.facts={};c.proposals[0].missing=["Support missing"];
  expect(duplicateReviewSummary(c)!.finding.title).toBe("Possible duplicate; not confirmed");
  c.facts={support};expect(duplicateReviewSummary(c)!.finding.title).toBe("Duplicate reported; review incomplete");
 });
 it("does not call unchecked or failed execution fixed",()=>{
  expect(duplicateReviewSummary(executed("executed",false))!.correction.title).toBe("Correction recorded; not yet checked");
  expect(duplicateReviewSummary(executed("verification_failed",false))!.correction.title).toBe("Correction did not pass the checks");
 });
 it("describes exactly what changed after current execution passes and the manager closes it",()=>{
  const result=duplicateReviewSummary(executed("resolved",true))!;
  expect(result.correction.detail).toContain("SR-LAB-02 was reversed for $5,017.79");
  expect(result.correction.detail).toContain("Valid unpaid bill SR-LAB-01 remains");
  expect(result.reference).toBe("SAMPLE-CORRECTION");
  expect(duplicateReviewSummary(executed("verified",true))!.correction.title).toContain("manager confirmation needed");
 });
 it("keeps old executions, historical support and dismissal distinct from a verified fix",()=>{
  const c=executed("resolved",true);c.execution!.proposalId="old";
  expect(duplicateReviewSummary(c)!.recordedResult).toBe(false);
  expect(duplicateReviewSummary(c,0)).toBeNull();
  c.status="dismissed";expect(duplicateReviewSummary(c)!.correction.title).toBe("Closed without a correction");
 });
 it("describes rejection of an unposted duplicate without claiming a posted reversal",()=>{
  const c=executed("resolved",true);c.proposals[0].route="Invoice rejection";
  expect(duplicateReviewSummary(c)!.correction.detail).toContain("Extra unposted bill SR-LAB-02 was rejected");
  expect(duplicateReviewSummary(c)!.correction.detail).not.toContain("was reversed");
 });
});
