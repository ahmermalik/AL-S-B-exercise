# Local build integration contract

Implementation began October 31, 2026. `src/shared/types.ts` is the shared JSON boundary. No deployment is authorized in this turn.

## Server modules

- `src/server/db.ts`: exports `db` (Drizzle), `sqlite` (better-sqlite3), `initializeDatabase()` and auth schema connection. Auth schema lives in `src/server/auth-schema.ts` (root agent owns).
- `src/server/store.ts`: exports `importWorkbook(buffer: Buffer, filename: string): Promise<ImportSummary>`, `getWorkspace(): Workspace`, `getCase(id): CaseDetail | null`, `applyCaseAction(id, action: CaseAction, actor: {id,name,role}): CaseDetail`, `getPackageDraft(propertyId): PackageDraft`, `savePackage({propertyId,fingerprint,summary,acknowledged}, actor): PackageSnapshot`, `getPackage(id): PackageSnapshot | null`.
- Store also exports `createRun(importId): Run`, `getRun(id?): Run | null`, `cancelRun(id): Run`, `resumeRun(id): Run`, `claimRun(workerId): Run | null`, `heartbeatRun(id,workerId): boolean`, `updateRun(id,workerId,patch): boolean`, `prepareFindings(importId): void`, `listRunCases(importId): CaseDetail[]`, `saveAgentProposal(caseId,expectedRevision,proposal: Omit<Proposal,'id'|'version'|'createdAt'|'disposition'>): CaseDetail`. Worker checks lease/cancel/version before commits. Data owner may refine the exact worker patch types with the worker agent.
- `src/server/llm.ts`: exports `isAiConfigured()`, `reviseCaseWithAi(caseDetail): Promise<Proposal input>`, `draftSummary(cases): Promise<string>`; requires actual key/model and never substitutes a fixture AI response.
- `src/worker.ts`: separate persistent worker. No inline timers in the web server pretending to process jobs.

## HTTP boundary (root owns routes)

Authenticated GET `/api/workspace` → Workspace. GET `/api/cases/:id` → CaseDetail. POST `/api/cases/:id/actions` takes CaseAction → CaseDetail. Server validates session, origin, role and expected revision. Errors `{error:string}` with appropriate 400/401/403/404/409/503.

GET `/api/preparation` → `{source: ImportSummary|null,run:Run|null}`. POST multipart with `file` imports actual workbook. POST JSON `{action:'start'|'cancel'|'resume',runId?}` controls worker runs.

GET `/api/packages?propertyId=P105` → PackageDraft. POST `{propertyId,fingerprint,summary:string|null,acknowledged:true}` → PackageSnapshot. POST `/api/packages/summary` `{propertyId}` → `{summary,fingerprint}` (actual AI). GET `/api/packages/:id/export?format=html|csv` → snapshot report/download.

Better Auth mounts `/api/auth/[...all]`. GET `/api/session` → `{user:{id,name,email,role}}`. UI normal login with two seeded local accounts. Root provides seeding; UI agent uses `createAuthClient` in `better-auth/react` signIn.email/signOut.

GET `/api/reset` → `{resetGeneration}`. Every non-auth workflow mutation sends `X-Workspace-Generation`; missing or stale values return 409. Body decoding is followed by another generation check, and workbook imports retain the captured generation through asynchronous parsing. Preparation start also includes the current `importId`; a stale selected source cannot start a run against a different import.

POST `/api/reset` with `{confirmed:true}` is available to either authenticated role. It atomically clears shared workflow records, rotates the generation, restores only the original workbook with a fresh import identity, and returns `{resetGeneration,reloadedSource,source,cleared,removedArchivedFiles,cleanupWarnings}`. Auth accounts/sessions and migrations remain. There is no automatic preparation or model call. The browser clears summary drafts and fully reloads; other browser contexts detect the new generation on focus/poll and discard old UI state. Reset tests must use a dedicated database directory because source archives are stored alongside the database.

UI routes: `/` workspace, `/prepare`, `/cases/[id]`, `/packages` and `/login`. Property selection uses query parameter `propertyId`. All four share one consistent shell. No fixture/demo banners or disclaimers. Keep real missing-support/approval/execution states.

## Ownership

Data agent owns db/domain/import/store/tests + migrations. UI agent owns pages/components/globals. Worker agent owns llm/worker/jobs tests. Root owns scaffold/auth/routes/scripts/integration/end-to-end checks. Coordinate shared contracts before changes; do not overwrite another owner's files.
