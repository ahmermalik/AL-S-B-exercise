import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exceedsCommentaryThreshold, normalizeInvoice, requiresRegionalApproval } from "./import";
import type { Actor } from "./store";
import type { CaseDetail } from "../shared/types";

const manager: Actor = {id: "manager", name: "Accounting manager", role: "manager"};
const accountant: Actor = {id: "accountant", name: "Staff accountant", role: "accountant"};
const originalDatabase = process.env.DATABASE_PATH;
const testDir = mkdtempSync(join(tmpdir(), "asset-close-"));
let store: typeof import("./store"), database: typeof import("./db");
let importId: string;

async function workbook() {
  const w = new ExcelJS.Workbook();
  const readme = w.addWorksheet("README");readme.getCell("A18").value = "Policy notes: invoices over $10,000 need Regional Manager approval before they are paid. Variance commentary is required for any category more than 10% off budget.";
  const p = w.addWorksheet("B0 Properties");p.addRows([["Property ID", "Property", "Segment", "Market", "Region", "Units", "Status"], ["P105", "Sunset Ridge", "MF", "Houston", "Gulf", 200, "Active"], ["P126", "Campus Edge", "Student", "Austin", "Central", 150, "Active"]]);
  const coa = w.addWorksheet("B1 Chart of Accounts");coa.addRows([["GL Code", "Account Name", "Category"], ["5110", "Payroll - Site Staff", "Payroll"], ["6120", "Turnover", "R&M"], ["6130", "HVAC", "R&M"], ["6210", "Landscaping", "Contract Services"], ["6410", "Electric", "Utilities"], ["6510", "Office supplies", "Admin"], ["7110", "Capital appliances", "CapEx"], ["7120", "Capital flooring", "CapEx"]]);
  const ap = w.addWorksheet("B2 AP Invoices Sep-26");ap.addRow(["Line #", "Invoice #", "Vendor", "Property ID", "Property", "GL Code", "Description", "Amount ($)", "Invoice Date", "Received Date", "Approval Status", "Coded By"]);
  const invoice = (line: number, id: string, vendor: string, gl: string, description: string, amount: number) => [line,id,vendor,"P105","Sunset Ridge",gl,description,amount,new Date("2026-09-01"),new Date("2026-09-05"),"Approved","J. Ramirez"];
  ap.addRows([invoice(1,"INV-88241","StaffBridge Temp Labor","5110","Temp maintenance tech",5017.79),invoice(2,"88241","StaffBridge Temp Labor","5110","Temp maintenance tech",5017.79),invoice(3,"INV-89546","Office Depot-Style","6510","Office supplies",502.34),invoice(4,"89546","Office Depot-Style","6510","Office supplies",502.34),invoice(5,"INV-88242","Lone Star Lawn Co.","6410","Monthly grounds maintenance",2214.16),invoice(6,"LIMIT-10000","Threshold vendor","6510","Office supplies",10000),invoice(7,"LIMIT-10001","Approval vendor","6510","Office supplies",10000.01),invoice(8,"CAP-FLOOR","Turn materials vendor","7120","Unit turn",3649.31),invoice(9,"CAP-HVAC","Cooling vendor","7110","HVAC repair",749.49)]);
  const v = w.addWorksheet("B3 Budget vs Actual Sep-26");v.addRows([["Property ID","Property","Region","Category","Sep-26 Budget ($)","Sep-26 Actual ($)","Variance Commentary"],["P105","Sunset Ridge","Gulf","Utilities",100,90,""],["P126","Campus Edge","Central","Payroll",36050,47226,""]]);
  const t=w.addWorksheet("B4 Close Tracker");t.addRows([["Property ID","Property","Region","Staff Accountant","Close Step","Due (Business Day)","Completed (Business Day)","Status (as of BD6)"],["P105","Sunset Ridge","Gulf","J. Ramirez","AP cutoff & accruals","BD3","BD7","Complete"],["P105","Sunset Ridge","Gulf","J. Ramirez","Bank reconciliation","BD3",null,"Late"],["P126","Campus Edge","Central","P. Okafor","Variance commentary","BD6","BD6","Complete"]]);
  return Buffer.from(await w.xlsx.writeBuffer());
}
function byTitle(text: string) { return store.getPackageDraft("P105").cases.find(c => c.title.includes(text))!; }
function action(c: CaseDetail, a: Parameters<typeof store.applyCaseAction>[1], actor=manager) {return store.applyCaseAction(c.id,a,actor);}
function supported(c: CaseDetail) {
  const s=store.getSupportTemplate(c.id)!;
  c=action(c,{action:"support",expectedRevision:c.revision,support:s},accountant);
  c=action(c,{action:"prepare",expectedRevision:c.revision});
  return c;
}
beforeAll(async()=>{
  process.env.DATABASE_PATH=join(testDir,"contracts.sqlite");
  database=await import("./db");database.initializeDatabase();store=await import("./store");
  const source=await store.importWorkbook(await workbook(),"source.xlsx");importId=source.id;store.prepareFindings(importId);
});
afterAll(()=>{database?.sqlite.close();process.env.DATABASE_PATH=originalDatabase;rmSync(testDir,{recursive:true,force:true});});

describe("accounting boundaries",()=>{
  it("uses strict thresholds, both signs, zero-budget outcome and conservative normalization",()=>{
    expect(requiresRegionalApproval(1_000_000)).toBe(false);expect(requiresRegionalApproval(1_000_001)).toBe(true);
    expect(exceedsCommentaryThreshold(10000,11000)).toBe(false);expect(exceedsCommentaryThreshold(10000,8999)).toBe(true);expect(exceedsCommentaryThreshold(0,0)).toBe(false);expect(exceedsCommentaryThreshold(0,1)).toBe(true);
    expect(normalizeInvoice(" inv-88241 ")).toBe("88241");expect(normalizeInvoice("INT-88241")).toBe("INT-88241");
  });
  it("preserves source rows and does not manufacture posting or duplicate payment",()=>{
    const c=byTitle("StaffBridge");expect(c.status).toBe("candidate");expect(c.evidence).toHaveLength(2);expect(c.evidence[0].source?.row).toBe(2);expect(c.proposals[0].missing.length).toBeGreaterThan(0);expect(c.proposals[0].journal).toEqual([]);
    expect(()=>action(c,{action:"approve",expectedRevision:c.revision,proposalId:c.proposals[0].id})).toThrow(/incomplete/);
  });
  it("rejects malformed support and unauthorized review mutations",()=>{
    const c=byTitle("StaffBridge");
    expect(()=>store.applyCaseAction(c.id,{action:"support",expectedRevision:c.revision,support:{}} as never,accountant)).toThrow();
    expect(()=>action(c,{action:"support",expectedRevision:c.revision,support:store.getSupportTemplate(c.id)!})).toThrow(/cannot/);
    expect(()=>action(c,{action:"dismiss",expectedRevision:c.revision,reason:"No duplicate"},accountant)).toThrow(/cannot/);
  });
  it("retains the source author separately from the accountant recording support",()=>{
    let c=store.getPackageDraft("P126").cases.find(c=>c.kind==="variance")!;
    const support={author:"Property payroll owner",period:"September 2026",explanation:"September payroll explanation",transactionId:"",entity:"",postingState:"unknown" as const,paymentState:"unknown" as const,duplicateConfirmed:false,periodOpen:false,correctionAuthorized:false,invoiceRecord:"",ledgerRecord:"September payroll ledger extract",paymentRecord:"",policyRecord:""};
    c=action(c,{action:"support",expectedRevision:c.revision,support},accountant);
    const added=c.evidence.filter(e=>e.version===c.evidenceVersion);
    expect(added.every(e=>e.author==="Property payroll owner")).toBe(true);
    expect(added.every(e=>(e.data?.recordedBy as {id:string}).id===accountant.id)).toBe(true);
    expect(c.history.at(-1)?.actor).toBe(accountant.name);expect(c.history.at(-1)?.action).toContain("Property payroll owner");
  });
  it("binds financial support to the original invoice and rejects legacy missing-reference approvals",()=>{
    let c=byTitle("Lone Star");const template=store.getSupportTemplate(c.id)!;
    expect(template.invoiceReference).toBe("INV-88242");expect(template.invoiceRecord).toContain("INV-88242");
    for (const invoiceReference of [undefined,"INV-UNRELATED-01"]) {
      c=action(c,{action:"support",expectedRevision:c.revision,support:{...template,invoiceReference}},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});
      expect(c.proposals.at(-1)?.missing.some(message=>message.toLowerCase().includes("invoice reference"))).toBe(true);
      expect(c.proposals.at(-1)?.journal).toEqual([]);
      expect(()=>action(c,{action:"approve",expectedRevision:c.revision,proposalId:c.proposals.at(-1)!.id})).toThrow(/incomplete/);
    }
    c=action(c,{action:"support",expectedRevision:c.revision,support:{...template,invoiceReference:"88242"}},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});
    expect(c.proposals.at(-1)?.missing).toEqual([]);c=action(c,{action:"approve",expectedRevision:c.revision,proposalId:c.proposals.at(-1)!.id});
    const record=c.facts.executionTemplate as Record<string,unknown>;
    const legacy=structuredClone(c);(legacy.facts.support as {invoiceReference?:string}).invoiceReference=undefined;
    database.sqlite.prepare("UPDATE close_cases SET data=? WHERE id=?").run(JSON.stringify(legacy),legacy.id);
    expect(()=>action(legacy,{action:"execute",expectedRevision:legacy.revision,reference:"LEGACY-1",targetId:String(record.targetId),amountCents:legacy.amountCents,notes:"Old approved workpaper",refreshedRecord:JSON.stringify(record)},accountant)).toThrow(/invoice identity/);
    legacy.status="verified";database.sqlite.prepare("UPDATE close_cases SET data=? WHERE id=?").run(JSON.stringify(legacy),legacy.id);
    expect(()=>action(legacy,{action:"resolve",expectedRevision:legacy.revision})).toThrow(/invoice identity/);
    c=action(legacy,{action:"support",expectedRevision:legacy.revision,support:template},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});expect(c.proposals.at(-1)?.journal).toHaveLength(2);
  });
  it("cannot turn capital-versus-expense candidates into a generic expense reclass",()=>{
    for (const vendor of ["Turn materials vendor", "Cooling vendor"]) {
      let c=byTitle(vendor);expect(c.facts.currentCategory).toBe("CapEx");expect(c.proposals.at(-1)?.route).toBe("Accounting treatment review");
      const genericSupport={...store.getSupportTemplate(byTitle("Lone Star").id)!,transactionId:`CAP-${vendor}`,explanation:"Generic reclass request",policyRecord:"Manager permits same-entity expense reclasses."};
      c=action(c,{action:"support",expectedRevision:c.revision,support:genericSupport},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});
      expect(c.proposals.at(-1)?.journal).toEqual([]);expect(c.proposals.at(-1)?.missing).toContain("Obtain capitalization policy and a supported accounting-treatment decision");expect(c.proposals.at(-1)?.rationale).not.toContain("Total expense, AP and cash do not change");
      expect(()=>action(c,{action:"approve",expectedRevision:c.revision,proposalId:c.proposals.at(-1)!.id})).toThrow(/accounting-treatment/);
      expect(c.facts.executionTemplate).toBeNull();
    }
  });
});
describe("versioned correction workflow",()=>{
  it("binds approval to current evidence; a conflicting refreshed record blocks resolution",()=>{
    let c=supported(byTitle("StaffBridge"));const p=c.proposals.at(-1)!;
    expect(p.route).toBe("AP reversal");expect(p.journal).toEqual([]);
    c=action(c,{action:"approve",expectedRevision:c.revision,proposalId:p.id});expect(c.status).toBe("approved");
    for(const a of ["prepare","edit","return","dismiss","request"] as const) expect(()=>action(c,{action:a,expectedRevision:c.revision,summary:"Changed",reason:"Changed",text:"Changed"} as never)).toThrow(/open review/);
    const record: Record<string,unknown>={...(c.facts.executionTemplate as Record<string,unknown>),amountCents:c.amountCents-1};
    c=action(c,{action:"execute",expectedRevision:c.revision,reference:"APREV-100",targetId:String(record.targetId),amountCents:c.amountCents,notes:"AP reversal and refreshed extracts",refreshedRecord:JSON.stringify(record)},accountant);
    c=action(c,{action:"verify",expectedRevision:c.revision});expect(c.status).toBe("verification_failed");expect(()=>action(c,{action:"resolve",expectedRevision:c.revision})).toThrow(/verification/);
    const correct=c.facts.executionTemplate as Record<string,unknown>;
    c=action(c,{action:"execute",expectedRevision:c.revision,reference:"APREV-101",targetId:String(correct.targetId),amountCents:c.amountCents,notes:"Corrected refreshed extract",refreshedRecord:JSON.stringify(correct)},accountant);
    c=action(c,{action:"verify",expectedRevision:c.revision});expect(c.status).toBe("verified");c=action(c,{action:"resolve",expectedRevision:c.revision});expect(c.status).toBe("resolved");
    expect(byTitle("Office Depot").status).toBe("candidate");
    const old=c;const support={...store.getSupportTemplate(c.id)!,explanation:"Updated supporting record"};c=action(c,{action:"support",expectedRevision:c.revision,support},accountant);expect(c.status).toBe("awaiting_evidence");expect(c.evidenceVersion).toBe(2);expect(c.proposals.at(-1)?.disposition).toBe("approved");
    expect(()=>action(old,{action:"prepare",expectedRevision:old.revision})).toThrow(/changed/);
    expect(()=>action(c,{action:"execute",expectedRevision:c.revision,reference:"WRONG",targetId:support.transactionId,amountCents:c.amountCents,notes:"Old approval",refreshedRecord:JSON.stringify(correct)},accountant)).toThrow(/current approved/);
  });
  it("drafts balanced conditional coding entries and rejects unposted invoices without a JE",()=>{
    const coding=supported(byTitle("Lone Star"));expect(coding.proposals.at(-1)?.route).toBe("Expense reclassification");expect(coding.proposals.at(-1)?.journal.map(l=>l.account)).toEqual(["6210","6410"]);expect(coding.proposals.at(-1)?.journal.reduce((n,l)=>n+l.debitCents-l.creditCents,0)).toBe(0);
    const office=supported(byTitle("Office Depot"));expect(office.proposals.at(-1)?.route).toBe("Invoice rejection");expect(office.proposals.at(-1)?.journal).toEqual([]);
  });
  it("materializes packages with all open issues and rejects a stale package review",()=>{
    const draft=store.getPackageDraft("P105");const saved=store.savePackage({propertyId:"P105",fingerprint:draft.fingerprint,summary:null,acknowledged:true},manager);const text=JSON.stringify(saved);
    let c=byTitle("Office Depot");c=action(c,{action:"dismiss",expectedRevision:c.revision,reason:"Underlying source investigation found separate valid obligations."});expect(c.status).toBe("dismissed");expect(JSON.stringify(store.getPackage(saved.id))).toBe(text);expect(saved.openCount).toBe(draft.cases.filter(c=>!["resolved","dismissed"].includes(c.status)).length);
    expect(()=>store.savePackage({propertyId:"P105",fingerprint:draft.fingerprint,summary:null,acknowledged:true},manager)).toThrow(/changed/);
  });
  it("reviews actual approver-role records rather than substituting manager approval for Regional sign-off",()=>{
    let c=byTitle("Regional approval");const row=(c.facts.invoices as {source:{row:number}}[])[0].source.row;
    expect(c.proposals.at(-1)?.missing[0]).toContain("LIMIT-10001 · Approval vendor");expect(c.proposals.at(-1)?.missing[0]).not.toMatch(/\brow\s+\d+/i);
    const base={author:accountant.name,period:"September 2026",explanation:"Approval register extract",transactionId:"",entity:"",postingState:"unknown" as const,paymentState:"unknown" as const,duplicateConfirmed:false,periodOpen:false,correctionAuthorized:false,invoiceRecord:"",ledgerRecord:"",paymentRecord:"",policyRecord:""};
    c=action(c,{action:"support",expectedRevision:c.revision,support:{...base,approvalRecords:[{invoiceRow:row,approverRole:"CFO",reference:"APP-1",approvedBeforePayment:true}]}},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});expect(c.proposals.at(-1)?.missing.length).toBe(1);
    c=action(c,{action:"support",expectedRevision:c.revision,support:{...base,approvalRecords:[{invoiceRow:row,approverRole:"Regional Manager",reference:"APP-2",approvedBeforePayment:true}]}},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});expect(c.proposals.at(-1)?.missing).toEqual([]);
    c=action(c,{action:"approve",expectedRevision:c.revision,proposalId:c.proposals.at(-1)!.id});expect(c.status).toBe("verified");expect(c.execution).toBeNull();c=action(c,{action:"resolve",expectedRevision:c.revision});expect(c.status).toBe("resolved");
  });
  it("requires completed work records by BD6 for all affected close steps without rewriting B4",()=>{
    let c=byTitle("Close tracker");const before=store.getWorkspace().properties.find(p=>p.id==="P105")!.steps;
    const base={author:accountant.name,period:"September 2026",explanation:"Updated workpapers",transactionId:"",entity:"",postingState:"unknown" as const,paymentState:"unknown" as const,duplicateConfirmed:false,periodOpen:false,correctionAuthorized:false,invoiceRecord:"",ledgerRecord:"",paymentRecord:"",policyRecord:""};
    c=action(c,{action:"support",expectedRevision:c.revision,support:{...base,closeRecords:[{step:"AP cutoff & accruals",completedBD:7,reference:"WP-1"},{step:"Bank reconciliation",completedBD:6,reference:"WP-2"}]}},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});expect(c.proposals.at(-1)?.missing.length).toBe(1);
    c=action(c,{action:"support",expectedRevision:c.revision,support:{...base,closeRecords:[{step:"AP cutoff & accruals",completedBD:6,reference:"WP-3"},{step:"Bank reconciliation",completedBD:6,reference:"WP-2"}]}},accountant);c=action(c,{action:"prepare",expectedRevision:c.revision});expect(c.proposals.at(-1)?.missing).toEqual([]);c=action(c,{action:"approve",expectedRevision:c.revision,proposalId:c.proposals.at(-1)!.id});expect(c.status).toBe("verified");expect(store.getWorkspace().properties.find(p=>p.id==="P105")!.steps).toEqual(before);
  });
});
describe("persistent job ownership",()=>{
  it("deduplicates active jobs and prevents cancelled workers from committing",()=>{
    const run=store.createRun(importId);expect(store.createRun(importId).id).toBe(run.id);expect(store.claimRun("worker-a")?.id).toBe(run.id);expect(store.claimRun("worker-b")).toBeNull();expect(store.heartbeatRun(run.id,"worker-b")).toBe(false);
    store.cancelRun(run.id);expect(store.updateRun(run.id,"worker-a",{status:"complete"})).toBe(false);expect(store.markRunCase(run.id,"worker-a",byTitle("StaffBridge").id,"complete")).toBe(false);
    store.resumeRun(run.id);expect(store.claimRun("worker-b")?.id).toBe(run.id);
  });
});
