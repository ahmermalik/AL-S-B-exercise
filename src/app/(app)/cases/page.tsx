import type { Metadata } from "next";
import { CasesScreen } from "@/components/cases-index";
export const metadata: Metadata = { title: "Case review" };
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; property?: string }> }) {
  const { kind, property } = await searchParams;
  return <CasesScreen key={`${kind || ""}:${property || ""}`} kind={typeof kind === "string" ? kind : undefined} property={typeof property === "string" ? property : undefined} />;
}
