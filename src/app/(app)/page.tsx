import type { Metadata } from "next";
import { WorkspaceScreen } from "@/components/workspace";
type Params = Promise<Record<string, string | string[] | undefined>>;
export default async function Page({ searchParams }: { searchParams: Params }) {
  const params = await searchParams, one = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  return <WorkspaceScreen initial={{ filter: one("filter"), accountant: one("accountant"), stage: one("stage"), property: one("property"), view: one("view") }} />;
}
export const metadata: Metadata = { title: "Workspace" };
