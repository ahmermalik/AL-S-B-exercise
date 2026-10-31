import type { Metadata } from "next";
import { CasesScreen } from "@/components/cases-index";
export const metadata: Metadata = { title: "Case review" };
export default function Page() { return <CasesScreen />; }
