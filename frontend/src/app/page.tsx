import Link from "next/link";

// ── FAQ data for schema markup ─────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "What is VidToReels?",
    a: "VidToReels is an AI-powered platform that does two things: (1) turns long YouTube videos into short viral clips by detecting the best moments and auto-cropping to vertical format, and (2) generates complete AI faceless videos from scratch — just type a topic and the AI writes a script, generates images, adds voiceover, and creates a publish-ready video.",
  },
  {
    q: "How does the YouTube to Clips feature work?",
    a: "Paste any YouTube URL. Our AI downloads the video, transcribes the audio, identifies the most engaging moments using LLM analysis, and renders vertical 9:16 clips with smart face-tracking crop. The whole process takes 4-8 minutes. You get download-ready MP4 files.",
  },
  {
    q: "What are AI Faceless Videos?",
    a: "Faceless videos are content where no person appears on camera. You pick a topic (like '5 facts about black holes'), choose a visual style (Ghibli, Anime, Cinematic, etc.), select a narrator voice, and our AI writes the script, generates matching images, records the voiceover, adds background music, and assembles a complete video. Perfect for educational, storytelling, or motivation channels.",
  },
  {
    q: "Is VidToReels free to use?",
    a: "Yes! The free plan includes 2 videos per month with 3 clips per video. No credit card required. Upgrade to Pro or Business for higher limits and additional features.",
  },
  {
    q: "Can I publish directly to YouTube and Instagram?",
    a: "Yes. Connect your YouTube channel or Instagram account in Settings, and publish clips or faceless videos directly from the dashboard with one click. The AI even generates optimized titles, descriptions, and tags for you.",
  },
  {
    q: "Do you have an API?",
    a: "Yes. Generate an API key from your dashboard and use our REST API to submit videos, create faceless videos, check job status, and download clips programmatically. Full documentation with code examples is available at vidtoreels.com/docs.",
  },
  {
    q: "What video formats and platforms are supported?",
    a: "We support YouTube URLs and direct video uploads (MP4, MOV). Output clips are available in 9:16 (vertical — Shorts, Reels, TikTok), 1:1 (square), 4:5 (Instagram feed), and 16:9 (landscape). All clips are H.264/AAC encoded for maximum platform compatibility.",
  },
  {
    q: "How is this different from other AI video tools?",
    a: "VidToReels combines two powerful features in one platform: intelligent clip extraction from existing videos AND AI faceless video generation from scratch. Most competitors only offer one. Plus, we offer direct publishing to YouTube and Instagram, a developer API, and our pricing starts at free.",
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

// JSON-LD for Organization + SoftwareApplication + WebSite
function OrgSchema() {
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "VidToReels",
      url: "https://vidtoreels.com",
      logo: "https://vidtoreels.com/icon",
      contactPoint: {
        "@type": "ContactPoint",
        email: "contact@vidtoreels.com",
        contactType: "customer support",
      },
      sameAs: [],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "VidToReels",
      url: "https://vidtoreels.com",
      description:
        "AI-powered platform to turn YouTube videos into viral clips and create AI faceless videos from scratch.",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "VidToReels",
      url: "https://vidtoreels.com",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
      },
      description:
        "AI-powered platform to turn YouTube videos into viral clips and create AI faceless videos from scratch.",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "120",
        bestRating: "5",
      },
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
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <FaqSchema />
      <OrgSchema />
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to { background-position: 200% center; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-gradient {
          background: linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb, #4f46e5);
          background-size: 300% 300%;
          animation: gradientShift 6s ease infinite;
        }
        .animate-fade-up { animation: fadeUp 0.7s ease forwards; }
        .animate-fade-up-1 { animation: fadeUp 0.7s ease 0.1s both; }
        .animate-fade-up-2 { animation: fadeUp 0.7s ease 0.2s both; }
        .animate-fade-up-3 { animation: fadeUp 0.7s ease 0.3s both; }
        .animate-fade-up-4 { animation: fadeUp 0.7s ease 0.4s both; }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #818cf8, #a78bfa, #60a5fa, #818cf8);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        .card-hover {
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          border-color: #4f46e5;
          box-shadow: 0 8px 30px rgba(79, 70, 229, 0.15);
        }
        .glow-btn {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .glow-btn:hover {
          box-shadow: 0 0 24px rgba(99, 102, 241, 0.5);
          transform: translateY(-1px);
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          NAV
      ══════════════════════════════════════════════════════════════════════ */}
      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold shimmer-text">VidToReels</span>
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium glow-btn"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative max-w-5xl mx-auto text-center px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[500px] rounded-full bg-indigo-600/8 blur-[140px]" />
        </div>

        <div className="animate-fade-up">
          <span className="inline-block bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs px-3.5 py-1 rounded-full mb-6 font-medium tracking-wide">
            Two powerful tools, one platform
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6 animate-fade-up-1 tracking-tight">
          Turn videos into viral clips.
          <br />
          <span className="shimmer-text">Create faceless videos with AI.</span>
        </h1>

        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto animate-fade-up-2 leading-relaxed">
          Paste a YouTube URL to extract the best moments — or type a topic and let AI
          generate a complete video with script, images, voiceover, and music.
          Publish directly to YouTube, Instagram, and TikTok.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up-3">
          <Link
            href="/register"
            className="animate-gradient text-white px-8 py-3.5 rounded-xl text-base font-semibold glow-btn"
          >
            Start creating for free
          </Link>
          <Link
            href="/docs"
            className="border border-gray-700 hover:border-indigo-600 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl text-base font-medium transition-all"
          >
            View API docs
          </Link>
        </div>

        {/* Two demo cards side by side */}
        <div className="mt-16 grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto animate-fade-up-4">
          {/* YouTube clips demo */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-md bg-red-900/50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </span>
              <span className="text-xs font-medium text-gray-300">YouTube to Clips</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Downloading video", done: true },
                { label: "AI selecting best moments", done: true },
                { label: "Rendering clip 3/5", done: false },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className={done ? "text-green-400" : "text-indigo-400"}>{done ? "\u2713" : "\u25CB"}</span>
                  <span className="text-gray-400">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full animate-gradient" style={{ width: "65%" }} />
            </div>
          </div>

          {/* Faceless video demo */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-md bg-purple-900/50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
              </span>
              <span className="text-xs font-medium text-gray-300">AI Faceless Video</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "AI writing script", done: true },
                { label: "Generating images (Ghibli)", done: true },
                { label: "Adding voiceover (Emma)", done: false },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className={done ? "text-green-400" : "text-purple-400"}>{done ? "\u2713" : "\u25CB"}</span>
                  <span className="text-gray-400">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600" style={{ width: "72%" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SOCIAL PROOF BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-y border-gray-800/60 bg-gray-900/30 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "4-8 min", label: "Avg. processing time" },
              { value: "6 styles", label: "AI visual styles" },
              { value: "6 voices", label: "Natural AI narrators" },
              { value: "4 formats", label: "Output ratios" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TWO CORE FEATURES — Side by side
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Two ways to create viral content</h2>
          <p className="text-gray-400 max-w-xl mx-auto">Whether you have existing content or want to create from scratch, VidToReels has you covered.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Feature 1: YouTube to Clips */}
          <div className="bg-gradient-to-br from-red-950/30 via-gray-900 to-gray-900 border border-red-900/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-red-900/40 border border-red-800/40 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">YouTube to Clips</h3>
                <span className="text-xs text-gray-500">Repurpose existing content</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Paste any YouTube URL and our AI analyzes the entire video to find the most
              engaging moments. It transcribes audio, scores segments for virality,
              and renders face-tracked vertical clips — ready for Shorts, Reels, or TikTok.
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                "AI-powered best moment detection",
                "Face-tracking smart crop (9:16, 1:1, 4:5, 16:9)",
                "Auto-generated subtitles / captions",
                "Up to 20 clips per video",
                "AI-generated YouTube titles & descriptions",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-gray-300">
                  <span className="text-red-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Feature 2: Faceless Videos */}
          <div className="bg-gradient-to-br from-purple-950/30 via-gray-900 to-gray-900 border border-purple-900/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-purple-900/40 border border-purple-800/40 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">AI Faceless Videos</h3>
                <span className="text-xs text-purple-400/80 font-medium">NEW</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Type any topic — like &ldquo;5 terrifying deep sea creatures&rdquo; — and the AI
              writes a script, generates stunning images in your chosen style, records natural
              voiceover, adds background music, and delivers a complete publish-ready video.
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                "6 visual styles: Ghibli, Anime, Cartoon, Comic, Cinematic, Watercolor",
                "6 natural AI voices with preview",
                "Background music library (7 tracks)",
                "6 subtitle/text styles",
                "10s to 60s video duration",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-gray-300">
                  <span className="text-purple-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          USE CASES — Run a channel without showing your face
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-900/40 border-y border-gray-800/60 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Run a social media channel on autopilot</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Creators are building profitable YouTube, TikTok, and Instagram channels — without ever showing their face or spending hours editing.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: "\uD83D\uDCDA",
                niche: "Educational Content",
                desc: "\"5 facts about...\" science, history, or space channels that get millions of views with AI-narrated explainers.",
                example: "e.g. \"5 mind-blowing facts about black holes\"",
              },
              {
                icon: "\uD83D\uDC7B",
                niche: "Scary Stories",
                desc: "Horror narration channels on TikTok and YouTube. AI writes and narrates creepy stories with dark, atmospheric visuals.",
                example: "e.g. \"3 true scary stories from Reddit\"",
              },
              {
                icon: "\u2694\uFE0F",
                niche: "Mythology & History",
                desc: "Ancient myths, historical events, or war stories told through dramatic AI art and compelling narration.",
                example: "e.g. \"The fall of the Roman Empire\"",
              },
              {
                icon: "\uD83D\uDCAA",
                niche: "Motivation & Self-Help",
                desc: "Daily motivational shorts with powerful quotes, inspiring visuals, and energetic voiceover. Build a loyal audience.",
                example: "e.g. \"3 habits of highly successful people\"",
              },
              {
                icon: "\uD83C\uDF93",
                niche: "Kids & Family",
                desc: "Bedtime stories, fun facts for kids, and educational cartoons. Safe, family-friendly content generated by AI.",
                example: "e.g. \"The story of a brave little rabbit\"",
              },
              {
                icon: "\uD83C\uDFA4",
                niche: "Podcast & Interview Clips",
                desc: "Have a long podcast or interview? Extract the most quotable 30-second moments and turn them into viral clips automatically.",
                example: "YouTube to Clips feature",
              },
            ].map(({ icon, niche, desc, example }) => (
              <div key={niche} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 card-hover">
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold text-white text-base mb-2">{niche}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-3">{desc}</p>
                <span className="text-xs text-gray-600 italic">{example}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">How it works</h2>
          <p className="text-gray-400">From idea to published video in minutes, not hours.</p>
        </div>

        {/* YouTube Clips flow */}
        <div className="mb-16">
          <h3 className="text-sm uppercase tracking-widest text-red-400 font-semibold mb-6 text-center">YouTube to Clips</h3>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Paste URL", desc: "Drop any YouTube link into the dashboard." },
              { step: "2", title: "AI analyzes", desc: "Transcription, scoring, and moment detection run in the cloud." },
              { step: "3", title: "Get clips", desc: "Download vertical clips with face-tracking crop and captions." },
              { step: "4", title: "Publish", desc: "One-click publish to YouTube or Instagram with AI metadata." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-red-600/60 flex items-center justify-center text-sm font-bold text-red-400 mx-auto mb-4 bg-gray-950">
                  {step}
                </div>
                <h4 className="text-sm font-semibold text-white mb-1.5">{title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Faceless flow */}
        <div>
          <h3 className="text-sm uppercase tracking-widest text-purple-400 font-semibold mb-6 text-center">AI Faceless Videos</h3>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Pick a topic", desc: "Choose a category and describe what the video is about." },
              { step: "2", title: "Customize", desc: "Select visual style, voice, music, text style, and duration." },
              { step: "3", title: "AI creates", desc: "Script, images, voiceover, and assembly — all automatic." },
              { step: "4", title: "Publish", desc: "Download or publish directly to YouTube and Instagram." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-purple-600/60 flex items-center justify-center text-sm font-bold text-purple-400 mx-auto mb-4 bg-gray-950">
                  {step}
                </div>
                <h4 className="text-sm font-semibold text-white mb-1.5">{title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ALL FEATURES GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-900/40 border-y border-gray-800/60 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything you need to go viral</h2>
            <p className="text-gray-400">Built for creators, marketers, agencies, and developers.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { title: "Smart AI Clip Detection", desc: "LLM-powered analysis identifies the most engaging, shareable moments from any video automatically.", color: "text-blue-400" },
              { title: "Face-Tracking Crop", desc: "OpenCV-based face detection keeps your subject perfectly centered in every vertical clip.", color: "text-green-400" },
              { title: "AI Script Writing", desc: "Advanced LLM writes engaging narration scripts with perfect pacing for short-form video.", color: "text-purple-400" },
              { title: "AI Image Generation", desc: "SDXL generates stunning visuals in 6 artistic styles — Ghibli, Anime, Cinematic, and more.", color: "text-pink-400" },
              { title: "Natural AI Voiceover", desc: "6 human-sounding voices (3 male, 3 female) with adjustable pacing for natural narration.", color: "text-yellow-400" },
              { title: "Background Music", desc: "7 curated music tracks across moods — suspenseful, peaceful, cinematic, energetic, and more.", color: "text-orange-400" },
              { title: "Subtitle Styles", desc: "6 text styles including Bold Stroke, Karaoke, Red Highlight — like the top TikTok creators.", color: "text-cyan-400" },
              { title: "YouTube Publishing", desc: "Connect your channel and publish with AI-generated titles, descriptions, and tags in one click.", color: "text-red-400" },
              { title: "Instagram Reels", desc: "Connect your Instagram business account and publish reels directly from the dashboard.", color: "text-pink-400" },
              { title: "Auto Captions", desc: "AI transcribes and burns English subtitles into clips. Non-English audio auto-translated.", color: "text-emerald-400" },
              { title: "Developer API", desc: "REST API with key auth. Automate video creation via scripts, n8n, Zapier, or any HTTP client.", color: "text-indigo-400" },
              { title: "Multiple Formats", desc: "Output in 9:16 (Shorts/Reels), 1:1 (Square), 4:5 (Feed), or 16:9 (Landscape).", color: "text-violet-400" },
            ].map(({ title, desc, color }) => (
              <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-5 card-hover">
                <h3 className={`text-sm font-semibold mb-2 ${color}`}>{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          API SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs px-3 py-1 rounded-full mb-4 font-medium">
              Developer-friendly
            </span>
            <h2 className="text-3xl font-bold mb-4">Automate with the API</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Generate API keys from your dashboard and create clips or faceless videos programmatically.
              Build automation pipelines with n8n, Zapier, Make, or your own scripts.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 mb-6">
              {[
                "Submit YouTube URLs or create faceless videos via API",
                "Poll job status and download clips programmatically",
                "Full REST API with code examples in Python, curl, and more",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5 shrink-0">✓</span>
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
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="text-xs text-gray-500 ml-2 font-mono">terminal</span>
            </div>
            <pre className="text-xs text-green-300 font-mono p-5 overflow-x-auto leading-relaxed">{`# Create an AI faceless video
curl -X POST https://vidtoreels.com/api/faceless/submit \\
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
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="bg-gray-900/40 border-y border-gray-800/60 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-400">Start free. No credit card required. Scale as you grow.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free",
                price: "\u20B90",
                period: "forever",
                features: [
                  "2 videos/month",
                  "3 clips per video",
                  "YouTube to Clips",
                  "AI Faceless Videos",
                  "API access",
                  "All visual styles & voices",
                ],
                highlight: false,
                cta: "Get started free",
              },
              {
                name: "Pro",
                price: "\u20B91,499",
                period: "/month",
                features: [
                  "20 videos/month",
                  "10 clips per video",
                  "Up to 60 min source video",
                  "YouTube & Instagram publishing",
                  "Priority processing",
                  "API access",
                ],
                highlight: true,
                cta: "Start Pro trial",
              },
              {
                name: "Business",
                price: "\u20B93,999",
                period: "/month",
                features: [
                  "Unlimited videos",
                  "20 clips per video",
                  "Up to 3 hr source video",
                  "YouTube & Instagram publishing",
                  "Concurrent processing",
                  "Full API access",
                ],
                highlight: false,
                cta: "Start Business",
              },
            ].map(({ name, price, period, features, highlight, cta }) => (
              <div
                key={name}
                className={`relative rounded-2xl p-6 border card-hover ${
                  highlight
                    ? "border-indigo-500 bg-indigo-950/40"
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
                      <span className="text-green-400 text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block text-center text-sm font-medium py-2.5 rounded-lg transition-all ${
                    highlight
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white glow-btn"
                      : "border border-gray-700 hover:border-indigo-600 text-gray-300 hover:text-white"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Frequently asked questions</h2>
          <p className="text-gray-400">Everything you need to know about VidToReels.</p>
        </div>
        <div className="space-y-4">
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
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-900/40 border-y border-gray-800/60 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
              <div className="w-[500px] h-[300px] rounded-full bg-indigo-600/8 blur-[100px]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 tracking-tight">
              Ready to build your content empire?
            </h2>
            <p className="text-gray-400 mb-8 text-lg max-w-lg mx-auto">
              Join creators who are growing their channels 10x faster with AI-powered video creation. Start free today.
            </p>
            <Link
              href="/register"
              className="inline-block animate-gradient text-white px-10 py-4 rounded-xl text-base font-semibold glow-btn"
            >
              Create your free account
            </Link>
            <p className="mt-4 text-xs text-gray-600">No credit card required. Free plan includes 2 videos/month.</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTACT
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="contact" className="max-w-3xl mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Get in touch</h2>
          <p className="text-gray-400">Have questions, feedback, or partnership inquiries? We&apos;d love to hear from you.</p>
        </div>
        <form
          action="https://formsubmit.co/lovedeep5.abh@gmail.com"
          method="POST"
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          {/* FormSubmit config */}
          <input type="hidden" name="_subject" value="VidToReels Contact Form" />
          <input type="hidden" name="_captcha" value="false" />
          <input type="hidden" name="_next" value="https://vidtoreels.com?contacted=true" />
          <input type="text" name="_honey" className="hidden" />

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="name" className="block text-xs text-gray-400 mb-1.5 font-medium">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="Your name"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-600 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="you@example.com"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-600 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label htmlFor="subject" className="block text-xs text-gray-400 mb-1.5 font-medium">Subject</label>
            <select
              id="subject"
              name="subject_type"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:border-indigo-600 focus:outline-none transition-colors"
            >
              <option value="general">General inquiry</option>
              <option value="support">Technical support</option>
              <option value="partnership">Partnership / Business</option>
              <option value="feedback">Feature request / Feedback</option>
              <option value="bug">Bug report</option>
            </select>
          </div>
          <div>
            <label htmlFor="message" className="block text-xs text-gray-400 mb-1.5 font-medium">Message</label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Tell us how we can help..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-600 focus:outline-none transition-colors resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg text-sm font-semibold glow-btn transition-all"
          >
            Send message
          </button>
          <p className="text-center text-xs text-gray-600">
            Or email us directly at{" "}
            <a href="mailto:contact@vidtoreels.com" className="text-indigo-400 hover:underline">
              contact@vidtoreels.com
            </a>
          </p>
        </form>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-8">
            <div>
              <span className="text-base font-bold shimmer-text">VidToReels</span>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                AI-powered video creation platform. Turn YouTube videos into viral clips or create faceless videos from scratch.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Product</h4>
              <div className="space-y-2 text-sm">
                <Link href="/register" className="block text-gray-500 hover:text-white transition-colors">YouTube to Clips</Link>
                <Link href="/register" className="block text-gray-500 hover:text-white transition-colors">Faceless Videos</Link>
                <Link href="/docs" className="block text-gray-500 hover:text-white transition-colors">API</Link>
                <Link href="/billing" className="block text-gray-500 hover:text-white transition-colors">Pricing</Link>
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
              &copy; {new Date().getFullYear()} VidToReels. All rights reserved.
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
