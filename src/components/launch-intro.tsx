"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

// Lives in the persistent app shell: a fresh page load plays it once;
// client-side navigation keeps the finished state.
export function LaunchIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"intro" | "reveal" | "done">("intro");

  useEffect(() => {
    const reveal = window.setTimeout(() => setPhase("reveal"), 2000);
    const finish = window.setTimeout(() => setPhase("done"), 2280);
    return () => { window.clearTimeout(reveal); window.clearTimeout(finish); };
  }, []);

  return <>
    {phase !== "done" && <div className={`launch-intro${phase === "reveal" ? " launch-intro--exit" : ""}`} role="status" aria-label="Opening Close review">
      <div className="launch-lockup" aria-hidden="true">
        <div className="launch-logo"><Image src="/brand/asset-living-white.svg" width={344} height={72} alt="" priority /></div>
        <span className="launch-title">Close faster, catch more</span>
        <div className="launch-track"><span /><span /><span /><span /></div>
      </div>
    </div>}
    <div className={phase === "intro" ? "launch-content launch-content--waiting" : "launch-content"} inert={phase === "intro"} aria-hidden={phase === "intro" ? true : undefined}>{children}</div>
  </>;
}
