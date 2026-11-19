import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "center", padding: 82, background: "#17191f", color: "#f9fafb",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 38, fontWeight: 700 }}>
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#2c333a"/>
          <path d="M9 24h8m14 0h8" stroke="#a5f3c7" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="24" cy="24" r="7" stroke="#a5f3c7" strokeWidth="3"/>
        </svg>
        commitcred.
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 91, fontWeight: 700, marginTop: 42, lineHeight: 1.12 }}>
        <span>Your commits.</span>
        <span style={{ color: "#a5f3c7" }}>Your credit.</span>
      </div>
      <span style={{ marginTop: 30, fontSize: 31, color: "#c4cbd4" }}>Editable sprint reports from public GitHub activity</span>
    </div>,
    { width: 1200, height: 630 },
  );
}
