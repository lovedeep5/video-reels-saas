import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation — VidToReels",
  description:
    "VidToReels REST API docs. Create AI videos, check job status, and download clips programmatically. Includes code examples in cURL, Python, and JavaScript.",
  openGraph: {
    title: "API Documentation — VidToReels",
    description:
      "Integrate AI video creation into your app. Full REST API with code examples.",
    url: "https://vidtoreels.com/docs",
  },
  alternates: { canonical: "/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
