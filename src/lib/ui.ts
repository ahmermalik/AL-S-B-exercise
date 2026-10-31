import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const dateTime = (value: string) => new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
export const statusLabel = (status: string) => ({ candidate: "Needs review", awaiting_evidence: "Awaiting evidence", ready: "Ready for review", approved: "Approved · execution pending", executed: "Execution recorded", verification_failed: "Verification failed", verified: "Ready to resolve", resolved: "Resolved", dismissed: "Dismissed", queued: "Queued", running: "In progress", partial: "Drafting incomplete", complete: "Complete", failed: "Failed", cancelled: "Cancelled" }[status] || status.replaceAll("_", " "));
export function displayId(value: string) { return value.replace(/DEMO-/g, ""); }

