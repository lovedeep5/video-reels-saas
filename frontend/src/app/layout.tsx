import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import FacebookPixel from "@/components/FacebookPixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidToReels — AI Video Creator & Auto-Publisher",
  description:
    "Create AI-powered faceless videos in seconds. Type a topic — AI writes the script, generates visuals, adds voiceover and music. Auto-post to YouTube & Instagram. Free to start.",
  keywords: [
    "AI video creator",
    "faceless video maker",
    "AI video generator",
    "auto post YouTube",
    "Instagram Reels creator",
    "AI content creator",
    "faceless YouTube channel",
    "schedule YouTube videos",
    "AI voiceover video",
    "TikTok video maker",
    "YouTube Shorts creator",
    "AI reels maker",
    "video creation tool",
    "social media automation",
    "AI video publisher",
  ],
  openGraph: {
    title: "VidToReels — Create AI Videos. Publish Everywhere.",
    description:
      "AI-powered video creation + auto-publishing. Type a topic, pick a style, and get a publish-ready video in minutes. Schedule or auto-post to YouTube & Instagram.",
    url: "https://vidtoreels.com",
    siteName: "VidToReels",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://vidtoreels.com/images/og-cover.jpg",
        width: 1200,
        height: 630,
        alt: "VidToReels — AI Video Creator & Auto-Publisher",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VidToReels — Create AI Videos. Publish Everywhere.",
    description:
      "AI video creation + auto-publishing to YouTube & Instagram. Free to start.",
    images: ["https://vidtoreels.com/images/og-cover.jpg"],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL("https://vidtoreels.com"),
  alternates: { canonical: "/" },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  other: {
    "facebook-domain-verification":
      process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION || "",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/login">
      <html lang="en">
        <body>
          <GoogleAnalytics />
          <FacebookPixel />
          <ClerkTokenSync />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
