import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — VidToReels",
  description:
    "Privacy Policy for VidToReels by Flaircross Consultancy. How we collect, use, and protect your data.",
  openGraph: {
    title: "Privacy Policy — VidToReels",
    description: "Privacy Policy for VidToReels by Flaircross Consultancy.",
    url: "https://vidtoreels.com/privacy",
  },
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm mb-8 inline-block">
            ← Back to VidToReels
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mt-2">Last updated: March 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              VidToReels ("we", "us", "our") is a product of{" "}
              <a href="https://www.flaircross.com/" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">
                Flaircross Consultancy
              </a>
              . VidToReels is a SaaS tool that converts YouTube videos into
              short-form vertical clips using AI. Our service is available at{" "}
              <a href="https://vidtoreels.com" className="text-indigo-400 hover:text-indigo-300">
                vidtoreels.com
              </a>
              . This policy covers both the web application and the VidToReels Cookie Sync Chrome extension.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-200 mb-1">Account Information</h3>
                <p>
                  When you sign up via Clerk, we store your name and email address. We do not store
                  your password — authentication is managed entirely by Clerk.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-200 mb-1">YouTube URLs & Videos</h3>
                <p>
                  We process YouTube URLs you submit. Downloaded video files are temporarily stored
                  on our processing servers and deleted after clips are rendered. Rendered clips are
                  stored in AWS S3 and accessible only to your account.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-200 mb-1">YouTube Session Cookies (Chrome Extension)</h3>
                <p>
                  The VidToReels Cookie Sync Chrome extension reads YouTube and Google session
                  cookies from your Chrome browser. These cookies are transmitted securely over
                  HTTPS exclusively to <strong className="text-gray-200">vidtoreels.com</strong> and
                  are associated with your account only. They are used solely to authenticate
                  video downloads on your behalf and are never shared with any third party.
                  You can delete your synced cookies at any time from your account settings.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-200 mb-1">Usage Data</h3>
                <p>
                  We store records of jobs you submit (video URL, status, timestamps, clip count)
                  to power your dashboard and enforce plan limits.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-200 mb-1">Payment Information</h3>
                <p>
                  Payments are processed by Razorpay. We do not store your card details. We store
                  only your plan status and subscription identifiers returned by Razorpay.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>To process YouTube videos and deliver rendered clips to you</li>
              <li>To authenticate you and enforce your plan limits</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (e.g. account alerts) — no marketing without consent</li>
              <li>To debug errors and improve the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
            <p className="mb-3">We do not sell your data. We share data only with:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-300">Clerk</strong> — authentication provider</li>
              <li><strong className="text-gray-300">AWS</strong> — cloud infrastructure (S3 storage, EC2 processing, SQS)</li>
              <li><strong className="text-gray-300">MongoDB Atlas</strong> — database hosting</li>
              <li><strong className="text-gray-300">Razorpay</strong> — payment processing</li>
              <li><strong className="text-gray-300">OpenRouter</strong> — AI model API for clip selection and metadata generation</li>
            </ul>
            <p className="mt-3">
              All third-party services are used solely to operate VidToReels. No data is sold or
              shared for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Rendered clips are stored in S3 until you delete your account or the job</li>
              <li>Job records are retained while your account is active</li>
              <li>YouTube session cookies are overwritten each time you sync via the extension</li>
              <li>Temporary video files used during processing are deleted immediately after rendering</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Chrome Extension — Specific Disclosures</h2>
            <p className="mb-3">
              The VidToReels Cookie Sync extension has a single purpose: to sync your YouTube
              session cookies to your VidToReels account so the service can download videos on
              your behalf.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Cookies are read only when you click "Sync My YouTube Cookies"</li>
              <li>Cookies are sent only to <strong className="text-gray-300">vidtoreels.com</strong> over HTTPS</li>
              <li>No cookies are stored in the extension beyond the last-sync timestamp</li>
              <li>The extension does not track browsing activity</li>
              <li>The extension does not inject scripts into any web page</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p className="mb-3">You may at any time:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Delete your account and all associated data by contacting us</li>
              <li>Delete individual jobs and their clips from your dashboard</li>
              <li>Request a copy of your data</li>
              <li>Revoke YouTube cookie access by deleting your synced cookies from account settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Security</h2>
            <p>
              All data is transmitted over HTTPS. YouTube cookies are stored encrypted at rest in
              AWS S3 with access restricted to your account. We follow AWS security best practices
              including IAM least-privilege policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>
              For privacy questions or data deletion requests, contact us at{" "}
              <a href="mailto:privacy@vidtoreels.com" className="text-indigo-400 hover:text-indigo-300">
                privacy@vidtoreels.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
