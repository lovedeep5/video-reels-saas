import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing & Plans — VidToReels",
  description:
    "Choose your VidToReels plan. Free Starter, Creator at ₹499/mo, Pro at ₹1,499/mo, or Business at ₹3,999/mo. AI video creation, auto-posting, and scheduling included.",
  openGraph: {
    title: "Pricing & Plans — VidToReels",
    description:
      "AI video creation plans starting free. Create, schedule, and auto-post videos to YouTube & Instagram.",
    url: "https://vidtoreels.com/billing",
  },
  alternates: { canonical: "/billing" },
  robots: { index: false, follow: true },
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
