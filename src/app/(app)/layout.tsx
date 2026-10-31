import { headers } from "next/headers";
import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { Shell } from "@/components/shell";
import { SignInRedirect } from "@/components/sign-in-redirect";
import { ErrorState } from "@/components/common";
export const dynamic = "force-dynamic";
// Resolve the session once on the server so the header persists across pages instead of reloading on every navigation.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <SignInRedirect />;
  const { id, name, email, role } = session.user;
  if (role !== "manager" && role !== "accountant") return <main className="auth-loading"><ErrorState error="This account has no review access." /></main>;
  return <Shell user={{ id, name, email, role }}>{children}</Shell>;
}
