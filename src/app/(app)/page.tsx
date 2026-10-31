import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace";
export default function Page() { return <WorkspaceScreen />; }
export const metadata: Metadata = { title: "Workspace" };
