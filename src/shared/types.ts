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
export type CommentaryReviewState = "missing" | "wording_accepted" | "resolved" | "dismissed";
export interface CommentaryDiscrepancy {
  propertyId: string; propertyName: string; accountant: string;
  step: { status: string; dueBD: number; completedBD: number | null; source: SourceRef };
  categories: { category: string; budgetCents: number; actualCents: number; caseId: string | null; review: CommentaryReviewState; source: SourceRef }[];
}
export interface ThresholdReview { propertyId: string; propertyName: string; accountant: string; dueBD: number; status: string; source: SourceRef }
export interface AmountReview {
  invoice: string; vendor: string; propertyId: string; propertyName: string; description: string; gl: string;
  amountCents: number; invoiceDate: string; receivedDate: string; approval: string; codedBy: string; source: SourceRef;
  peerCount: number; peerMedianCents: number; peerLowCents: number; peerHighCents: number; multiple: number;
  owner: string; approvalCaseId: string | null; status: "outstanding";
}
export interface Attention {
  /** Distinct active properties with open overdue steps or required commentary outstanding in review. */
  followUp: { propertyIds: string[]; overdue: string[]; commentary: string[] };
  commentary: { discrepancies: CommentaryDiscrepancy[]; awaitingWording: number; thresholdReviews: ThresholdReview[]; dateConflicts: string[] };
  amounts: { reviews: AmountReview[]; totalCents: number; pendingCount: number; pendingCents: number; minPeers: number; robustDeviations: number };
}
export interface StageMatrix {
  asOfBD: number;
  stages: { name: string; dueBD: number; overdue: number; due: number }[];
  rows: { accountant: string; properties: number; overdue: number; due: number; cells: { overdue: number; due: number }[] }[];
  overdue: number; due: number;
}
export interface AiUsage { generated: number; approved: number; returned: number; pending: number; superseded: number }
export interface BriefingItem { text: string; links: string[] }
export interface Briefing { importId: string; fingerprint: string; items: BriefingItem[]; links: Record<string, string>; model: string; promptVersion: string; createdAt: string }
export interface Operations {
  matrix: StageMatrix; usage: AiUsage;
  briefing: { current: Briefing | null; fingerprint: string; stale: boolean };
  ai: { configured: boolean; model: string | null };
}
export interface Workspace {
  resetGeneration?: string;
  source: ImportSummary | null; properties: Property[]; cases: CaseSummary[]; run: Run | null;
  metrics: { activeProperties: number; lateProperties: number; commentaryGaps: number; openCases: number };
  attention: Attention | null;
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
