import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Actor } from "./store";

const directory = mkdtempSync(join(tmpdir(), "asset-reset-contract-"));
const beforeDatabase = process.env.DATABASE_PATH, beforeSource = process.env.SOURCE_WORKBOOK_PATH;
let database: typeof import("./db"), store: typeof import("./store");
let original: Buffer, alternate: Buffer;
const manager: Actor = {id: "reset-manager", name: "Manager", role: "manager"};
const accountant: Actor = {id: "reset-accountant", name: "Accountant", role: "accountant"};
async function workbook(amount: number) {
  const w = new ExcelJS.Workbook();
  w.addWorksheet("README").getCell("A18").value = "Policy notes: invoices over $10,000 need Regional Manager approval before they are paid. Variance commentary is required for any category more than 10% off budget.";
  w.addWorksheet("B0 Properties").addRows([["Property ID","Property","Segment","Market","Region","Units","Status"],["P105","Sunset Ridge","MF","Houston","Gulf",200,"Active"]]);
  w.addWorksheet("B1 Chart of Accounts").addRows([["GL Code","Account Name","Category"],["5110","Payroll - Site Staff","Payroll"]]);
  const ap=w.addWorksheet("B2 AP Invoices Sep-26");ap.addRows([["Line #","Invoice #","Vendor","Property ID","Property","GL Code","Description","Amount ($)","Invoice Date","Received Date","Approval Status","Coded By"],[1,"INV-88241","StaffBridge Temp Labor","P105","Sunset Ridge","5110","Temp maintenance tech",amount,new Date("2026-09-01"),new Date("2026-09-05"),"Approved","K. Brooks"],[2,"88241","StaffBridge Temp Labor","P105","Sunset Ridge","5110","Temp maintenance tech",amount,new Date("2026-09-01"),new Date("2026-09-06"),"Approved","J. Ramirez"]]);
  w.addWorksheet("B3 Budget vs Actual Sep-26").addRows([["Property ID","Property","Region","Category","Sep-26 Budget ($)","Sep-26 Actual ($)","Variance Commentary"],["P105","Sunset Ridge","Gulf","Payroll",10000,10000,""]]);
  w.addWorksheet("B4 Close Tracker").addRows([["Property ID","Property","Region","Staff Accountant","Close Step","Due (Business Day)","Completed (Business Day)","Status (as of BD6)"],["P105","Sunset Ridge","Gulf","J. Ramirez","AP cutoff & accruals","BD3","BD3","Complete"]]);
  return Buffer.from(await w.xlsx.writeBuffer());
}
const count=(table: string)=>(database.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n;
beforeAll(async()=>{
  // A unique DIRECTORY is essential: no test shares the working DB's archive directory.
  process.env.DATABASE_PATH=join(directory,"workspace.sqlite");process.env.SOURCE_WORKBOOK_PATH=join(directory,"unavailable.xlsx");
  database=await import("./db");database.initializeDatabase();store=await import("./store");
  original=await workbook(5017.79);alternate=await workbook(6017.79);
  for(const [id,email,role] of [[manager.id,"manager@test.local","manager"],[accountant.id,"accountant@test.local","accountant"]]) database.sqlite.prepare("INSERT INTO user(id,name,email,role,email_verified,created_at,updated_at) VALUES (?,?,?,?,1,1,1)").run(id,id,email,role);
  database.sqlite.prepare("INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES ('reset-session',9999999999999,'reset-token',1,1,?)").run(manager.id);
});
afterAll(()=>{database?.sqlite.close();if(beforeDatabase===undefined)delete process.env.DATABASE_PATH;else process.env.DATABASE_PATH=beforeDatabase;if(beforeSource===undefined)delete process.env.SOURCE_WORKBOOK_PATH;else process.env.SOURCE_WORKBOOK_PATH=beforeSource;rmSync(directory,{recursive:true,force:true});});

describe("global walkthrough reset",()=>{
  it("atomically clears workflow state, retains accounts/session/migrations, and reloads only the original workbook",async()=>{
    const first=await store.importWorkbook(original,"original.xlsx");store.prepareFindings(first.id);
    const oldCase=store.listRunCases(first.id)[0];
    store.applyCaseAction(oldCase.id,{action:"request",expectedRevision:oldCase.revision,text:"Provide source support"},manager);
    const run=store.createRun(first.id);store.claimRun("reset-worker");expect(store.recordRunAgentActivity(run.id,"reset-worker",{caseId:oldCase.id,event:"started"})).toBe(true);
    const draft=store.getPackageDraft("P105");const saved=store.savePackage({propertyId:"P105",fingerprint:draft.fingerprint,summary:null,acknowledged:true},manager);
    const second=await store.importWorkbook(alternate,"alternate.xlsx");store.prepareFindings(second.id);store.createRun(second.id);
    database.sqlite.prepare("INSERT INTO close_settings(key,value) VALUES ('temporary_filter','old')").run();
    const sourceFolder=join(directory,"sources"), unrelated=join(sourceFolder,"notes.txt");writeFileSync(unrelated,"retain unrelated file");
    const generation=store.getResetGeneration(), authCounts=[count("user"),count("session"),count("account"),count("close_migrations")];
    const result=await store.resetWorkspace({reloadSource:true,expectedGeneration:generation});
    expect(result.resetGeneration).not.toBe(generation);expect(result.source?.hash).toBe(first.hash);expect(result.source?.id).not.toBe(first.id);expect(result.source?.id).not.toBe(second.id);
    expect([count("user"),count("session"),count("account"),count("close_migrations")]).toEqual(authCounts);
    for(const table of ["close_cases","close_runs","close_run_cases","close_packages","close_agent_activity"])expect(count(table)).toBe(0);
    expect(count("close_imports")).toBe(1);expect(store.getWorkspace().source?.hash).toBe(first.hash);expect(store.getWorkspace().cases).toEqual([]);expect(store.getWorkspace().run).toBeNull();
    expect(store.getPackage(saved.id)).toBeNull();expect(store.getRun(run.id)).toBeNull();expect(store.getCase(oldCase.id)).toBeNull();
    expect(existsSync(join(sourceFolder,`${first.hash}.xlsx`))).toBe(true);expect(existsSync(join(sourceFolder,`${second.hash}.xlsx`))).toBe(false);expect(existsSync(unrelated)).toBe(true);
    expect(existsSync(join(sourceFolder,"original-source.json"))).toBe(true);expect(result.removedArchivedFiles).toBe(1);
    expect(database.sqlite.prepare("SELECT value FROM close_settings WHERE key='temporary_filter'").get()).toBeUndefined();
    expect(()=>store.assertResetGeneration(generation)).toThrow(/reset/);
    expect(()=>store.applyCaseAction(oldCase.id,{action:"request",expectedRevision:1,text:"Stale request"},manager)).toThrow(/not found/);
    expect(()=>store.createRun(first.id)).toThrow(/not found/);
    expect(store.recordRunAgentActivity(run.id,"reset-worker",{caseId:oldCase.id,event:"late"})).toBe(false);
    expect(store.prepareRunFindings(run.id,"reset-worker")).toBe(false);
    expect(store.recordAgentActivity({caseId:oldCase.id,importId:first.id,resetGeneration:generation,event:"late model"})).toBe(false);
    expect(store.recordAgentActivity({importId:first.id,event:"late summary"})).toBe(false);
    // An old-loaded worker's pre-patch INSERT is guarded by the DB, not just new helpers.
    const raw=database.sqlite.prepare("INSERT INTO close_agent_activity(id,case_id,run_id,created_at,data) VALUES (?,?,?,?,?)");
    expect(raw.run("old-worker",oldCase.id,run.id,new Date().toISOString(),JSON.stringify({event:"late"})).changes).toBe(0);
    expect(raw.run("old-summary",null,null,new Date().toISOString(),JSON.stringify({event:"late summary"})).changes).toBe(0);
    expect(count("close_agent_activity")).toBe(0);
    store.prepareFindings(result.source!.id);const fresh=store.listRunCases(result.source!.id)[0];expect(fresh.id).not.toBe(oldCase.id);expect(fresh.revision).toBe(1);
    expect(()=>store.saveAgentProposal(oldCase.id,1,store.buildRuleProposal(fresh))).toThrow(/not found/);
  });
  it("does not clear any workflow data when the original source cannot be restored",async()=>{
    const source=store.getWorkspace().source!, generation=store.getResetGeneration();
    const archive=join(directory,"sources",`${source.hash}.xlsx`);const backup=readFileSync(archive);unlinkSync(archive);
    const before={source:store.getWorkspace().source,cases:count("close_cases"),generation};
    await expect(store.resetWorkspace({reloadSource:true,expectedGeneration:generation})).rejects.toThrow(/unavailable/);
    expect(store.getWorkspace().source).toEqual(before.source);expect(count("close_cases")).toBe(before.cases);expect(store.getResetGeneration()).toBe(generation);
    writeFileSync(archive,backup);
  });
  it("rejects an upload started before reset and never resurrects that import after parsing",async()=>{
    const generation=store.getResetGeneration();
    const staleUpload=store.importWorkbook(alternate,"stale-upload.xlsx",{expectedGeneration:generation});
    const reset=await store.resetWorkspace({reloadSource:false,expectedGeneration:generation});
    await expect(staleUpload).rejects.toThrow(/reset/);
    expect(reset.reloadedSource).toBe(false);expect(store.getWorkspace().source).toBeNull();expect(count("close_imports")).toBe(0);expect(count("close_cases")).toBe(0);
    const fresh=await store.importWorkbook(original,"fresh.xlsx",{expectedGeneration:reset.resetGeneration});expect(fresh.id).toContain(reset.resetGeneration);
  });
  it("preserves original baseline metadata across an empty reset and reloads without starting preparation",async()=>{
    const generation=store.getResetGeneration();const result=await store.resetWorkspace({reloadSource:true,expectedGeneration:generation});
    expect(result.source?.filename).toBe("original.xlsx");expect(count("close_imports")).toBe(1);expect(count("close_cases")).toBe(0);expect(count("close_runs")).toBe(0);expect(store.getWorkspace().resetGeneration).toBe(result.resetGeneration);
  });
});
