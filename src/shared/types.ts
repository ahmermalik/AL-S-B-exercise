export type Role = "manager" | "accountant";
export type CaseKind = "duplicate" | "coding" | "variance" | "approval" | "close";
export type CaseStatus = "candidate" | "awaiting_evidence" | "ready" | "approved" | "executed" | "verification_failed" | "verified" | "resolved" | "dismissed";
export interface SourceRef { sheet: string; row: number; range?: string }
export interface CloseStep { name: string; dueBD: number; completedBD: number | null; status: string; source: SourceRef; conflict: boolean }
export interface Property {
  id: string; name: string; region: string; accountant: string; active: boolean;
  steps: CloseStep[]; lateCount: number; caseCount: number; commentaryGaps: number;
}
export interface ImportSummary {
  id: string; filename: string; hash: string; createdAt: string; period: string; asOfBD: number;
  counts: { properties: number; activeProperties: number; invoices: number; variances: number; steps: number };
  warnings: string[];
}
export interface Evidence {
  id: string; label: string; kind: string; author: string; text: string;
  version: number; createdAt: string; source?: SourceRef; data?: Record<string, unknown>;
}
export interface JournalLine { account: string; name: string; debitCents: number; creditCents: number }
export interface Proposal {
  id: string; version: number; evidenceVersion: number; route: string; summary: string;
  rationale: string; missing: string[]; sources: string[]; journal: JournalLine[];
  origin: "rules" | "ai" | "manager"; disposition: string; createdAt: string;
}
export interface CaseSummary {
  id: string; importId: string; propertyId: string; propertyName: string; kind: CaseKind;
  title: string; amountCents: number; status: CaseStatus; revision: number;
  evidenceVersion: number; nextAction: string; owner: string;
}
export interface HistoryEvent { id: string; actor: string; action: string; at: string }
export interface ExecutionRecord { reference: string; amountCents: number; targetId: string; notes: string; proposalId: string; evidenceVersion: number; at: string; verified: boolean }
export interface CaseDetail extends CaseSummary {
  facts: Record<string, unknown>; evidence: Evidence[]; proposals: Proposal[];
  requests: { id: string; text: string; author: string; at: string; status: string }[];
  execution: ExecutionRecord | null; history: HistoryEvent[];
}
export interface Run {
  id: string; importId: string; status: "queued" | "running" | "cancelled" | "partial" | "complete" | "failed";
  stage: string; progress: number; error: string | null; createdAt: string; updatedAt: string;
  completedCases: number; totalCases: number;
  /** When each stage began, recorded by the worker as the run progresses. */
  stageLog?: { name: string; at: string }[];
}
export interface Workspace {
  resetGeneration?: string;
  source: ImportSummary | null; properties: Property[]; cases: CaseSummary[]; run: Run | null;
  metrics: { activeProperties: number; lateProperties: number; commentaryGaps: number; openCases: number };
  ai: { configured: boolean; model: string | null };
}
export interface PackageSnapshot {
  id: string; version: number; propertyId: string; propertyName: string; importId: string;
  createdAt: string; createdBy: string; summary: string | null;
  cases: CaseDetail[]; source: ImportSummary; openCount: number;
}
export interface PackageDraft { propertyId: string; propertyName: string; source: ImportSummary; cases: CaseDetail[]; fingerprint: string; snapshots: PackageSnapshot[] }
export interface SupportInput {
  author: string; period: string; explanation: string;
  invoiceReference?: string;
  transactionId: string; retainedTransactionId?: string; entity: string;
  postingState: "posted" | "unposted" | "unknown";
  paymentState: "unpaid" | "scheduled" | "paid" | "unknown";
  duplicateConfirmed: boolean; periodOpen: boolean; correctionAuthorized: boolean;
  invoiceRecord: string; ledgerRecord: string; paymentRecord: string; policyRecord: string;
  approvalRecords?: { invoiceRow: number; approverRole: string; reference: string; approvedBeforePayment: boolean }[];
  closeRecords?: { step: string; completedBD: number; reference: string }[];
}
export type CaseAction =
  | { action: "request"; expectedRevision: number; text: string }
  | { action: "support"; expectedRevision: number; support: SupportInput }
  | { action: "prepare" | "revise-ai"; expectedRevision: number }
  | { action: "edit"; expectedRevision: number; summary: string }
  | { action: "approve"; expectedRevision: number; proposalId: string }
  | { action: "return" | "dismiss"; expectedRevision: number; reason: string }
  | { action: "execute"; expectedRevision: number; reference: string; targetId: string; amountCents: number; notes: string; refreshedRecord: string }
  | { action: "verify" | "resolve"; expectedRevision: number };
