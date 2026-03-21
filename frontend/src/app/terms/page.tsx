import Link from "next/link";

export const metadata = {
  title: "Terms of Service — VidToReels",
  description:
    "Terms of Service for VidToReels by Flaircross Consultancy. Covers account usage, content policies, payments, and third-party integrations.",
  openGraph: {
    title: "Terms of Service — VidToReels",
    description: "Terms of Service for VidToReels by Flaircross Consultancy.",
    url: "https://vidtoreels.com/terms",
  },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm mb-8 inline-block">
            &larr; Back to VidToReels
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Terms of Service</h1>
          <p className="text-gray-500 text-sm mt-2">Last updated: March 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              These Terms of Service ("Terms") govern your use of VidToReels, a product of{" "}
              <a href="https://www.flaircross.com/" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">
                Flaircross Consultancy
              </a>{" "}
              ("Company", "we", "us"). By accessing or using VidToReels at{" "}
              <a href="https://vidtoreels.com" className="text-indigo-400 hover:text-indigo-300">vidtoreels.com</a>,
              you agree to be bound by these Terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Service Description</h2>
            <p>
              VidToReels is a SaaS platform that uses AI to convert long-form videos into short-form
              vertical clips. The service includes video processing, AI-powered clip selection,
              and optional publishing to YouTube and Instagram.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Registration</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>You must provide accurate information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must be at least 18 years old to use the service</li>
              <li>One person may not maintain more than one account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Submit content you do not have the right to process or distribute</li>
              <li>Use the service to infringe on any copyright, trademark, or other intellectual property rights</li>
              <li>Attempt to bypass plan limits or abuse the service infrastructure</li>
              <li>Use automated tools to access the service beyond the provided API</li>
              <li>Distribute malware or use the service for any unlawful purpose</li>
              <li>Resell or redistribute the service without prior written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Content & Intellectual Property</h2>
            <p className="mb-3">
              You retain ownership of the videos you submit and the clips generated from them.
              By using the service, you grant us a limited, temporary license to process your
              content solely for the purpose of delivering the service.
            </p>
            <p>
              You are solely responsible for ensuring you have the necessary rights to any
              content you submit. We do not monitor or pre-screen user content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Plans & Payments</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Free and paid plans are available with different usage limits</li>
              <li>Paid subscriptions are billed through Razorpay on a recurring basis</li>
              <li>You may cancel your subscription at any time from your account settings</li>
              <li>Refunds are handled on a case-by-case basis — contact us within 7 days of payment</li>
              <li>We reserve the right to change pricing with 30 days&apos; notice to existing subscribers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Third-Party Integrations</h2>
            <p className="mb-3">
              VidToReels integrates with YouTube and Instagram for publishing. By connecting
              these accounts, you agree to their respective terms of service in addition to ours.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>We use YouTube API Services — you are also bound by the{" "}
                <a href="https://www.youtube.com/t/terms" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>{" "}
                and{" "}
                <a href="https://policies.google.com/privacy" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>
              </li>
              <li>Instagram publishing is subject to{" "}
                <a href="https://help.instagram.com/581066165581870" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">Instagram&apos;s Terms of Use</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted service.
              We may perform maintenance, updates, or experience outages. We are not liable for
              any losses resulting from service downtime.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Flaircross Consultancy shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your
              use of VidToReels. Our total liability shall not exceed the amount you paid us in
              the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms or engage in
              activity that harms the service or other users. You may delete your account at
              any time by contacting us. Upon termination, your data will be deleted in
              accordance with our{" "}
              <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated
              via email or a notice on the website. Continued use of the service after changes
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of India. Any disputes shall be subject to
              the exclusive jurisdiction of the courts in India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:contact@vidtoreels.com" className="text-indigo-400 hover:text-indigo-300">
                contact@vidtoreels.com
              </a>
              .
            </p>
            <p className="mt-3 text-gray-500">
              Flaircross Consultancy &mdash;{" "}
              <a href="https://www.flaircross.com/" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">
                www.flaircross.com
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
