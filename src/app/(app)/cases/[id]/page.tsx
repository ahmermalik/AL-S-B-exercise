import type { Metadata } from "next";
import { CaseReviewScreen } from "@/components/case-review";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CaseReviewScreen id={id} />; }
export const metadata: Metadata = { title: "Case" };
