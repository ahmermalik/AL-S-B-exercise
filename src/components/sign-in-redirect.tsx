"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loading } from "./common";
export function SignInRedirect() {
  const pathname = usePathname(); const router = useRouter();
  useEffect(() => { router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); }, [pathname, router]);
  return <main className="auth-loading"><Loading text="Redirecting to sign in" /></main>;
}
