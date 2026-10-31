import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
export const runtime = "nodejs";
export const alt = "Close review · Asset Living";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Branded link preview: Asset Blue ground, official logo, product name and the brand color stripe.
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/asset-living-white.svg"));
  const src = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#003C71", color: "white", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", flexDirection: "column", padding: "80px 88px 0" }}>
      <img src={src} width={382} height={80} alt="" />
      <div style={{ fontSize: 76, fontWeight: 700, marginTop: 72, letterSpacing: -2 }}>Close review</div>
      <div style={{ fontSize: 32, color: "#90D7F2", marginTop: 12 }}>Evidence-grounded month-end close for property accounting</div>
    </div>
    <div style={{ display: "flex", height: 14 }}><div style={{ flex: 1, background: "#00A1E4" }} /><div style={{ flex: 1, background: "#90D7F2" }} /><div style={{ flex: 1, background: "#A6CE39" }} /><div style={{ flex: 1, background: "#F2A900" }} /></div>
  </div>, size);
}
