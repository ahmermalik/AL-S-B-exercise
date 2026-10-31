import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "lenis/dist/lenis.css";
import "./globals.css";
import { MotionProvider } from "@/components/motion";
export const metadata: Metadata = {
  title: { template: "%s · Close review", default: "Close review · Asset Living" },
  description: "Evidence-grounded month-end close workspace for property accounting.",
  applicationName: "Close review",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#003c71" }, { media: "(prefers-color-scheme: dark)", color: "#0c1c2a" }] };
// Applies the saved appearance before first paint so a chosen theme never flashes the other one.
const appearanceScript = `try{var s=localStorage.getItem("close-appearance");if(s==="light"||s==="dark"){var d=document.documentElement;d.dataset.appearance=s;d.style.colorScheme=s}}catch(e){}`;
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Script id="appearance" strategy="beforeInteractive">{appearanceScript}</Script><MotionProvider>{children}</MotionProvider></body></html>;
}
