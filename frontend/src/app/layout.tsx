import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidToReels — AI Clips for Social Media",
  description: "Automatically extract and create vertical reels from any video using AI",
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
