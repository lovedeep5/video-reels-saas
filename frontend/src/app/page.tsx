import Link from "next/link";
import Image from "next/image";

// ── FAQ data for schema markup ─────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "What is VidToReels?",
    a: "VidToReels is an AI-powered video creation platform. Type any topic — AI writes a script, generates stunning images, records natural voiceover, adds music, and delivers a publish-ready vertical video. Then schedule it to auto-post to YouTube and Instagram.",
  },
  {
    q: "How does AI video creation work?",
    a: "Pick a topic (like '5 facts about black holes'), choose a visual style (Ghibli, Anime, Cinematic, etc.), select a narrator voice, and click Create. Our AI writes the script, generates matching images using Flux AI, records the voiceover, adds background music, and assembles a complete video in about 2 minutes.",
  },
  {
    q: "Can I schedule videos to auto-post?",
    a: "Yes! Connect your YouTube channel or Instagram account, then schedule videos to publish at specific times. Or enable auto-post to publish immediately when your video is ready. Available on Creator, Pro, and Business plans.",
  },
  {
    q: "Is VidToReels free to use?",
    a: "Yes! The Starter plan includes 2 videos per month (up to 30 seconds each) at no cost. No credit card required. Upgrade to Creator, Pro, or Business for longer videos, more volume, and scheduling features.",
  },
  {
    q: "What visual styles are available?",
    a: "We offer 12 AI visual styles: Comic, Creepy Comic, Modern Cartoon, Disney, Ghibli, Anime, Painting, Dark Fantasy, Lego, Polaroid, Realism, and Fantastic. Each produces unique, high-quality images tailored to your video's mood and genre.",
  },
  {
    q: "How long can videos be?",
    a: "Video duration depends on your plan: Starter (up to 30 seconds), Creator (up to 3 minutes), Pro (up to 10 minutes), Business (up to 60 minutes). All videos are rendered in 1080x1920 vertical format, optimized for YouTube Shorts, Instagram Reels, and TikTok.",
  },
  {
    q: "Do you have an API?",
    a: "Yes. Generate an API key from your dashboard and use our REST API to create videos, check status, and download results programmatically. Full documentation with code examples is available at vidtoreels.com/docs.",
  },
  {
    q: "What platforms can I publish to?",
    a: "Currently YouTube and Instagram. You can connect up to 5 channels/accounts and publish or schedule to any of them directly from the dashboard. TikTok support is coming soon.",
  },
];

// JSON-LD structured data for FAQ rich snippets
function FaqSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function OrgSchema() {
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "VidToReels",
      url: "https://vidtoreels.com",
      logo: "https://vidtoreels.com/icon",
      parentOrganization: {
        "@type": "Organization",
        name: "Flaircross Consultancy",
        url: "https://www.flaircross.com/",
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: "contact@vidtoreels.com",
        contactType: "customer support",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "VidToReels",
      url: "https://vidtoreels.com",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "INR", name: "Starter" },
        { "@type": "Offer", price: "499", priceCurrency: "INR", name: "Creator" },
        { "@type": "Offer", price: "1499", priceCurrency: "INR", name: "Pro" },
        { "@type": "Offer", price: "3999", priceCurrency: "INR", name: "Business" },
      ],
      description: "AI-powered platform to create faceless videos and auto-post to YouTube & Instagram.",
      /* aggregateRating omitted — will add when real reviews exist */
    },
  ];
  return (
    <>
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <FaqSchema />
      <OrgSchema />
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.5s ease both; }
        .fade-in-1 { animation: fadeIn 0.5s ease 0.1s both; }
        .fade-in-2 { animation: fadeIn 0.5s ease 0.2s both; }
        .fade-in-3 { animation: fadeIn 0.5s ease 0.3s both; }
      `}</style>

      {/* NAV */}
      <nav className="border-b border-gray-800/50 bg-gray-950/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-400">VidToReels</span>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/docs" className="hover:text-white transition-colors">API</Link>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:inline">
              Sign in
            </Link>
            <Link
              href="/register"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative max-w-5xl mx-auto text-center px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src="/images/hero/hero-main.webp"
            alt="AI video creation platform"
            fill
            className="object-cover opacity-15"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/60 via-gray-950/80 to-gray-950" />
        </div>

        <div className="fade-in">
          <span className="inline-block bg-indigo-950/80 border border-indigo-800/50 text-indigo-300 text-xs px-3.5 py-1 rounded-full mb-6 font-medium">
            AI Video Creator + Auto-Publisher
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6 fade-in-1 tracking-tight">
          Create AI Videos.
          <br />
          <span className="text-indigo-400">Publish Everywhere.</span>
        </h1>

        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto fade-in-2 leading-relaxed">
          Type a topic — AI writes the script, generates visuals, adds voiceover and music.
          Schedule or auto-post to YouTube and Instagram. From idea to published in minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 fade-in-3">
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:shadow-lg hover:shadow-indigo-600/25"
          >
            Start creating — free
          </Link>
          <Link
            href="/docs"
            className="border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl text-base font-medium transition-all"
          >
            View API docs
          </Link>
        </div>

        {/* Demo card */}
        <div className="mt-16 max-w-md mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-md bg-purple-900/50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
              </span>
              <span className="text-xs font-medium text-gray-300">Creating: &ldquo;5 facts about black holes&rdquo;</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "AI writing script", done: true },
                { label: "Generating images (Cinematic)", done: true },
                { label: "Recording voiceover (Emma)", done: true },
                { label: "Assembling video", done: false },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className={done ? "text-green-400" : "text-indigo-400"}>{done ? "\u2713" : "\u25CB"}</span>
                  <span className="text-gray-400">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: "82%" }} />
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-y border-gray-800/50 bg-gray-900/20 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "~2 min", label: "Average creation time" },
              { value: "6", label: "AI visual styles" },
              { value: "6", label: "Natural AI voices" },
              { value: "2", label: "Publishing platforms" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything you need to create and publish</h2>
          <p className="text-gray-400 max-w-xl mx-auto">AI handles the creative work. You focus on growing your audience.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 hover:border-gray-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-800/40 flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI Video Creation</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Type a topic. AI writes the script, generates images in your chosen style, records natural voiceover, adds music, and assembles a complete video.
            </p>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>6 visual styles (Ghibli, Anime, Cinematic...)</li>
              <li>6 AI voices with natural pacing</li>
              <li>Background music library</li>
              <li>Up to 60 minutes (Business plan)</li>
            </ul>
          </div>

          {/* Feature 2 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 hover:border-gray-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-800/40 flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Schedule & Auto-Post</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Connect YouTube and Instagram. Schedule videos to publish at specific times, or auto-post the moment your video is ready. No manual uploading.
            </p>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>Up to 5 connected channels</li>
              <li>Scheduled publishing with calendar</li>
              <li>Auto-post on video completion</li>
              <li>AI-generated titles, tags & descriptions</li>
            </ul>
          </div>

          {/* Feature 3 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 hover:border-gray-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-blue-800/40 flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Developer API</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Full REST API for programmatic video creation. Automate with n8n, Zapier, Make, or your own scripts. Create videos at scale.
            </p>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>API key authentication</li>
              <li>Create, poll, download via HTTP</li>
              <li>Python & curl examples</li>
              <li>Webhook notifications (coming soon)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="bg-gray-900/30 border-y border-gray-800/50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Build a channel without showing your face</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Creators are growing profitable YouTube, TikTok, and Instagram channels entirely with AI-generated content.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { niche: "Educational Content", desc: "Science, history, or space explainers that get millions of views.", example: "\"5 mind-blowing facts about black holes\"" },
              { niche: "Scary Stories", desc: "Horror narration with dark, atmospheric AI visuals.", example: "\"3 true scary stories from Reddit\"" },
              { niche: "Mythology & History", desc: "Ancient myths and historical events told through dramatic AI art.", example: "\"The fall of the Roman Empire\"" },
              { niche: "Motivation & Self-Help", desc: "Daily motivational shorts with powerful quotes and visuals.", example: "\"3 habits of highly successful people\"" },
              { niche: "Kids & Family", desc: "Bedtime stories and fun facts with safe, family-friendly content.", example: "\"The story of a brave little rabbit\"" },
              { niche: "Tech & Science", desc: "AI and technology explainers with cinematic visualizations.", example: "\"How does quantum computing work?\"" },
            ].map(({ niche, desc, example }) => (
              <div key={niche} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                <h3 className="font-semibold text-white text-sm mb-2">{niche}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-2">{desc}</p>
                <span className="text-xs text-gray-600 italic">{example}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">How it works</h2>
          <p className="text-gray-400">From idea to published video in 3 steps.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Pick a topic & style", desc: "Choose from categories like Scary Stories, Mythology, Science, or type your own. Select a visual style and AI voice." },
            { step: "2", title: "AI creates your video", desc: "In about 2 minutes, AI writes the script, generates images, records voiceover, adds music, and assembles the final video." },
            { step: "3", title: "Publish or schedule", desc: "Download your video, publish to YouTube or Instagram instantly, or schedule it to auto-post at the perfect time." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 rounded-full border-2 border-indigo-600/50 flex items-center justify-center text-base font-bold text-indigo-400 mx-auto mb-5 bg-gray-950">
                {step}
              </div>
              <h4 className="text-base font-semibold text-white mb-2">{title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* API SECTION */}
      <section className="bg-gray-900/30 border-y border-gray-800/50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block bg-indigo-950/80 border border-indigo-800/50 text-indigo-300 text-xs px-3 py-1 rounded-full mb-4 font-medium">
                Developer-friendly
              </span>
              <h2 className="text-3xl font-bold mb-4">Automate with the API</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Create videos programmatically. Build automation pipelines with n8n, Zapier, Make, or your own scripts.
              </p>
              <ul className="space-y-2 text-sm text-gray-300 mb-6">
                {[
                  "Create AI videos via REST API",
                  "Poll job status and download results",
                  "Full documentation with Python & curl examples",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5 shrink-0">{"\u2713"}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/docs"
                className="inline-block border border-indigo-600 text-indigo-300 hover:bg-indigo-600 hover:text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                Read API documentation
              </Link>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-950">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="text-xs text-gray-500 ml-2 font-mono">terminal</span>
              </div>
              <pre className="text-xs text-green-300 font-mono p-5 overflow-x-auto leading-relaxed">{`curl -X POST https://vidtoreels.com/api/faceless/submit \\
  -H "X-API-Key: vr_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "5 facts about black holes",
    "style": "cinematic",
    "voice": "emma",
    "duration": 30
  }'

# Response
{
  "job_ids": ["6641a2f3c4e1b9001234"],
  "message": "1 faceless video queued"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-400">Start free. No credit card required. Scale as you grow.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              name: "Starter",
              price: "\u20B90",
              period: "forever",
              features: ["2 videos/month", "Up to 30 seconds", "6 AI styles & voices", "Manual publishing", "API access"],
              highlight: false,
              cta: "Get started free",
            },
            {
              name: "Creator",
              price: "\u20B9499",
              period: "/month",
              features: ["15 videos/month", "Up to 3 minutes", "Scheduled publishing", "YouTube & Instagram", "No watermark"],
              highlight: false,
              cta: "Start Creator",
            },
            {
              name: "Pro",
              price: "\u20B91,499",
              period: "/month",
              features: ["50 videos/month", "Up to 10 minutes", "Auto-post on creation", "All platforms", "Priority queue"],
              highlight: true,
              cta: "Start Pro",
            },
            {
              name: "Business",
              price: "\u20B93,999",
              period: "/month",
              features: ["Unlimited videos", "Up to 60 minutes", "Batch creation", "Full API access", "Dedicated support"],
              highlight: false,
              cta: "Start Business",
            },
          ].map(({ name, price, period, features, highlight, cta }) => (
            <div
              key={name}
              className={`relative rounded-2xl p-6 border transition-colors hover:border-gray-700 ${
                highlight
                  ? "border-indigo-500 bg-indigo-950/30"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              {highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  Most popular
                </div>
              )}
              <h3 className="text-base font-bold mb-1 text-white">{name}</h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className={`text-3xl font-extrabold ${highlight ? "text-indigo-300" : "text-white"}`}>
                  {price}
                </span>
                <span className="text-gray-500 text-sm">{period}</span>
              </div>
              <ul className="space-y-2.5 text-sm text-gray-300 mb-6">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-green-400 text-xs">{"\u2713"}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`block text-center text-sm font-medium py-2.5 rounded-lg transition-all ${
                  highlight
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white"
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gray-900/30 border-y border-gray-800/50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Frequently asked questions</h2>
            <p className="text-gray-400">Everything you need to know about VidToReels.</p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details
                key={q}
                className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-medium text-white hover:text-indigo-300 transition-colors list-none">
                  {q}
                  <span className="text-gray-600 group-open:rotate-45 transition-transform text-lg ml-4 shrink-0">+</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 tracking-tight">
            Ready to create your first AI video?
          </h2>
          <p className="text-gray-400 mb-8 text-lg max-w-lg mx-auto">
            Join creators growing their channels with AI-powered video creation. Start free today.
          </p>
          <Link
            href="/register"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-xl text-base font-semibold transition-all hover:shadow-lg hover:shadow-indigo-600/25"
          >
            Create your free account
          </Link>
          <p className="mt-4 text-xs text-gray-600">No credit card required. Starter plan includes 2 videos/month.</p>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-gray-900/30 border-y border-gray-800/50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Get in touch</h2>
            <p className="text-gray-400">Questions, feedback, or partnership inquiries.</p>
          </div>
          <form
            action="https://formsubmit.co/lovedeep5.abh@gmail.com"
            method="POST"
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-5"
          >
            <input type="hidden" name="_subject" value="VidToReels Contact Form" />
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_next" value="https://vidtoreels.com?contacted=true" />
            <input type="text" name="_honey" className="hidden" />

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-xs text-gray-400 mb-1.5 font-medium">Name</label>
                <input type="text" id="name" name="name" required placeholder="Your name"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-600 focus:outline-none transition-colors" />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
                <input type="email" id="email" name="email" required placeholder="you@example.com"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-600 focus:outline-none transition-colors" />
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-xs text-gray-400 mb-1.5 font-medium">Message</label>
              <textarea id="message" name="message" required rows={4} placeholder="Tell us how we can help..."
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-600 focus:outline-none transition-colors resize-none" />
            </div>
            <button type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg text-sm font-semibold transition-all">
              Send message
            </button>
            <p className="text-center text-xs text-gray-600">
              Or email us at <a href="mailto:contact@vidtoreels.com" className="text-indigo-400 hover:underline">contact@vidtoreels.com</a>
            </p>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-8">
            <div>
              <span className="text-base font-bold text-indigo-400">VidToReels</span>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                AI-powered video creation and auto-publishing platform. Create, schedule, and grow.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Product</h4>
              <div className="space-y-2 text-sm">
                <Link href="/register" className="block text-gray-500 hover:text-white transition-colors">Create Video</Link>
                <Link href="/docs" className="block text-gray-500 hover:text-white transition-colors">API</Link>
                <a href="#pricing" className="block text-gray-500 hover:text-white transition-colors">Pricing</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Resources</h4>
              <div className="space-y-2 text-sm">
                <Link href="/docs" className="block text-gray-500 hover:text-white transition-colors">API Documentation</Link>
                <a href="#faq" className="block text-gray-500 hover:text-white transition-colors">FAQ</a>
                <a href="#contact" className="block text-gray-500 hover:text-white transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Account</h4>
              <div className="space-y-2 text-sm">
                <Link href="/register" className="block text-gray-500 hover:text-white transition-colors">Create account</Link>
                <Link href="/login" className="block text-gray-500 hover:text-white transition-colors">Sign in</Link>
                <Link href="/dashboard" className="block text-gray-500 hover:text-white transition-colors">Dashboard</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} <a href="https://www.flaircross.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Flaircross Consultancy</a>. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-gray-500">
              <a href="mailto:contact@vidtoreels.com" className="hover:text-white transition-colors">contact@vidtoreels.com</a>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
