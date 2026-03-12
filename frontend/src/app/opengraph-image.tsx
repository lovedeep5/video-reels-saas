import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VidToReels — AI Video Clips & Faceless Video Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 40%, #2d1b4e 70%, #1a1a3e 100%)",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decoration circles */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo / Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            {"▶"}
          </div>
          <span style={{ color: "#ffffff", fontSize: "28px", fontWeight: 700 }}>
            VidToReels
          </span>
        </div>

        {/* Main heading */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: "52px",
              fontWeight: 800,
              lineHeight: 1.15,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ color: "#ffffff" }}>AI Video Clips &</span>
            <span
              style={{
                background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Faceless Video Generator
            </span>
          </div>

          <div
            style={{
              fontSize: "22px",
              color: "#9ca3af",
              lineHeight: 1.5,
              maxWidth: "700px",
              display: "flex",
            }}
          >
            Turn YouTube videos into viral shorts or create AI faceless videos from scratch. Auto-crop, voiceover, captions & direct publishing.
          </div>
        </div>

        {/* Bottom feature pills */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {["YouTube to Clips", "AI Faceless Videos", "Auto Captions", "Direct Publishing", "Developer API"].map(
            (label) => (
              <div
                key={label}
                style={{
                  padding: "8px 20px",
                  borderRadius: "20px",
                  border: "1px solid rgba(99,102,241,0.4)",
                  background: "rgba(99,102,241,0.1)",
                  color: "#c4b5fd",
                  fontSize: "15px",
                  fontWeight: 500,
                  display: "flex",
                }}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "60px",
            color: "#6b7280",
            fontSize: "16px",
            display: "flex",
          }}
        >
          vidtoreels.com
        </div>
      </div>
    ),
    { ...size }
  );
}
