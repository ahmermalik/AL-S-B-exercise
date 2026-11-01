import type { Metadata } from "next";
import { connection } from "next/server";
import { WorkspaceScreen } from "@/components/workspace";
export default async function Page() {
  await connection();
  return <WorkspaceScreen />;
}
export const metadata: Metadata = { title: "Workspace" };
