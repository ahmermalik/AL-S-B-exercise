"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { ease, fadeUp, stagger } from "@/components/motion";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/common";
export default function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const result = await authClient.signIn.email({ email, password }); if (result.error) throw new Error(result.error.message || "Check your email and password."); const next = new URLSearchParams(window.location.search).get("returnTo"); router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/"); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in."); } finally { setBusy(false); } }
  return <main className="login-page"><motion.div className="login-brand" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}><Image src="/brand/asset-living-white.svg" width={191} height={40} alt="Asset Living" priority /></motion.div><motion.section className="login-card" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease, delay: 0.1 }}><motion.div variants={stagger(0.07, 0.3)} initial="hidden" animate="show"><motion.h1 variants={fadeUp}>Welcome back</motion.h1><motion.form variants={fadeUp} onSubmit={submit} className="form-stack"><label>Email<input required autoFocus type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <Notice>{error}</Notice>}<Button type="submit" loading={busy}>{busy ? "Signing in…" : <>Sign in<ArrowRight size={16} /></>}</Button></motion.form></motion.div></motion.section></main>;
}
