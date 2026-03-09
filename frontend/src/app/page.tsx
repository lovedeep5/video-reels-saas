import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
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
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.6; }
          70% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to { background-position: 200% center; }
        }
        @keyframes beam {
          0% { opacity: 0; transform: scaleX(0); }
          50% { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0; transform: scaleX(0); }
        }
        .animate-gradient {
          background: linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb, #4f46e5);
          background-size: 300% 300%;
          animation: gradientShift 6s ease infinite;
        }
        .animate-fade-up {
          animation: fadeUp 0.7s ease forwards;
        }
        .animate-fade-up-delay-1 { animation: fadeUp 0.7s ease 0.15s both; }
        .animate-fade-up-delay-2 { animation: fadeUp 0.7s ease 0.3s both; }
        .animate-fade-up-delay-3 { animation: fadeUp 0.7s ease 0.45s both; }
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
          box-shadow: 0 8px 30px rgba(79, 70, 229, 0.2);
        }
        .glow-btn {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .glow-btn:hover {
          box-shadow: 0 0 24px rgba(99, 102, 241, 0.6);
          transform: translateY(-1px);
        }
        .step-line::after {
          content: '';
          position: absolute;
          top: 20px;
          left: calc(50% + 28px);
          width: calc(100% - 56px);
          height: 1px;
          background: linear-gradient(90deg, #4f46e5, transparent);
        }
      `}</style>

      {/* Nav */}
      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold shimmer-text">VidToReels</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
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

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto text-center px-6 pt-28 pb-24">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />
        </div>

        <div className="animate-fade-up">
          <span className="inline-block bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-6 font-medium tracking-wide">
            AI-Powered Video Processing
          </span>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-up-delay-1 tracking-tight">
          Turn long videos into
          <br />
          <span className="shimmer-text">viral-ready reels</span>
        </h1>

        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto animate-fade-up-delay-2 leading-relaxed">
          Paste a YouTube URL or upload a video. Our AI detects the best moments,
          smart-crops to 9:16, and delivers download-ready vertical clips — in minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up-delay-3">
          <Link
            href="/register"
            className="animate-gradient text-white px-8 py-3.5 rounded-xl text-base font-semibold glow-btn"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="border border-gray-700 hover:border-indigo-600 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl text-base font-medium transition-all"
          >
            Sign in →
          </Link>
        </div>

        {/* Floating demo card */}
        <div className="mt-16 animate-float max-w-sm mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 relative">
                <div className="absolute inset-0 rounded-full bg-green-400" style={{animation: "pulse-ring 1.5s ease-out infinite"}} />
              </div>
              <span className="text-xs text-gray-400 font-mono">Processing video...</span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Downloading", pct: "100%", done: true },
                { label: "Analyzing content", pct: "100%", done: true },
                { label: "Rendering clip 3/5", pct: "60%", done: false },
              ].map(({ label, pct, done }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{label}</span>
                    <span className={done ? "text-green-400" : "text-indigo-400"}>{pct}</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${done ? "bg-green-500" : "animate-gradient"}`}
                      style={{ width: pct }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Everything you need</h2>
          <p className="text-gray-400">Built for creators, marketers, and developers.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "⚡",
              title: "Smart AI Detection",
              desc: "Audio energy analysis and scene detection pinpoint the most engaging moments automatically.",
            },
            {
              icon: "📐",
              title: "Auto 9:16 Crop",
              desc: "Face-tracking smart crop keeps your subject perfectly centered for every vertical clip.",
            },
            {
              icon: "🎬",
              title: "Instant Download",
              desc: "H.264/AAC encoded clips ready for Instagram Reels, TikTok, and YouTube Shorts.",
            },
            {
              icon: "🔗",
              title: "YouTube Support",
              desc: "Paste any YouTube URL — we download, process, and clip it without leaving the dashboard.",
            },
            {
              icon: "🔑",
              title: "Developer API",
              desc: "Generate API keys and process videos programmatically. Integrate into any workflow or automation.",
            },
            {
              icon: "📦",
              title: "Batch Processing",
              desc: "Run multiple videos concurrently. Check status via the dashboard or poll the API.",
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 card-hover"
            >
              <div className="text-2xl mb-4">{icon}</div>
              <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-900/50 border-y border-gray-800 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">How it works</h2>
            <p className="text-gray-400">From video to viral in three steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              {
                step: "01",
                title: "Submit your video",
                desc: "Paste a YouTube link or drag-and-drop an MP4/MOV file directly.",
              },
              {
                step: "02",
                title: "AI processes it",
                desc: "Audio scoring, scene detection, and face tracking run automatically in the background.",
              },
              {
                step: "03",
                title: "Download your clips",
                desc: "Get 30-40 second 9:16 clips, ready to post on any platform.",
              },
            ].map(({ step, title, desc }, i) => (
              <div key={step} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+32px)] right-0 h-px bg-gradient-to-r from-indigo-600/50 to-transparent" />
                )}
                <div className="w-12 h-12 rounded-full border-2 border-indigo-600 flex items-center justify-center text-sm font-bold text-indigo-400 mx-auto mb-5 bg-gray-950">
                  {step}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API section */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1 rounded-full mb-4 font-medium">
              Developer-friendly
            </span>
            <h2 className="text-3xl font-bold mb-4">Integrate with your workflow</h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Generate API keys from your dashboard and process videos programmatically.
              Plug into n8n, Zapier, or your own scripts — no UI required.
            </p>
            <Link
              href="/register"
              className="inline-block border border-indigo-600 text-indigo-300 hover:bg-indigo-600 hover:text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            >
              Get your API key
            </Link>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-950">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="text-xs text-gray-500 ml-2 font-mono">terminal</span>
            </div>
            <pre className="text-xs text-green-300 font-mono p-5 overflow-x-auto leading-relaxed">{`curl -X POST https://your-domain/api/videos/submit-url \\
  -H "Authorization: Bearer vr_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://youtube.com/watch?v=...",
    "clips_requested": 5
  }'

# Response
{
  "job_id": 42,
  "status": "queued"
}`}</pre>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-900/50 border-y border-gray-800 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-400">Start free. Scale as you grow.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free",
                price: "₹0",
                period: "forever",
                features: ["2 videos/month", "3 clips per video", "Up to 10 min video", "API access"],
                highlight: false,
                cta: "Get started",
              },
              {
                name: "Pro",
                price: "₹1,499",
                period: "/month",
                features: ["20 videos/month", "10 clips per video", "Up to 60 min video", "Priority processing", "API access"],
                highlight: true,
                cta: "Start Pro",
              },
              {
                name: "Business",
                price: "₹3,999",
                period: "/month",
                features: ["Unlimited videos", "20 clips per video", "Up to 3 hr video", "Concurrent processing", "API access"],
                highlight: false,
                cta: "Contact us",
              },
            ].map(({ name, price, period, features, highlight, cta }) => (
              <div
                key={name}
                className={`relative rounded-2xl p-6 border card-hover ${
                  highlight
                    ? "border-indigo-500 bg-indigo-950/50"
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
          <p className="text-center text-gray-600 text-xs mt-8">
            Payment integration coming soon. Sign up free today — no credit card required.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-28 text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[300px] rounded-full bg-indigo-600/10 blur-[100px]" />
          </div>
          <h2 className="text-4xl font-extrabold mb-5 tracking-tight">
            Ready to go viral?
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Join creators who are already repurposing content 10x faster.
          </p>
          <Link
            href="/register"
            className="inline-block animate-gradient text-white px-10 py-4 rounded-xl text-base font-semibold glow-btn"
          >
            Create your free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold shimmer-text">VidToReels</span>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} VidToReels. Built for creators.
          </p>
          <div className="flex gap-4 text-xs text-gray-500">
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
