import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidToReels — AI Video Clips & Faceless Video Generator",
  description:
    "Turn YouTube videos into viral clips or create AI faceless videos from scratch. Auto-crop, voiceover, captions, and publish to YouTube, Instagram & TikTok. Free to start.",
  keywords: [
    "AI video clips",
    "faceless video generator",
    "YouTube to shorts",
    "AI reels maker",
    "faceless reels",
    "video clipping tool",
    "AI video editor",
    "TikTok video maker",
    "Instagram reels generator",
    "YouTube Shorts creator",
    "auto crop video",
    "AI voiceover video",
  ],
  openGraph: {
    title: "VidToReels — AI Video Clips & Faceless Video Generator",
    description:
      "Turn long videos into viral clips or create AI faceless videos with script, images, and voiceover. Publish directly to YouTube & Instagram.",
    url: "https://vidtoreels.com",
    siteName: "VidToReels",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VidToReels — AI Video Clips & Faceless Videos",
    description:
      "Turn long videos into viral clips or create AI faceless videos. Free to start.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://vidtoreels.com" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/login">
      <html lang="en">
        <body>
          <ClerkTokenSync />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
