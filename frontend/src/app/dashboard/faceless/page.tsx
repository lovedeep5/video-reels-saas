"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

/* ── Data ────────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: "mythology", label: "Mythology & Legends", icon: "🏛️", topics: ["The Minotaur of Crete", "Thor vs the World Serpent", "The Story of Medusa"] },
  { id: "scary", label: "Scary Stories", icon: "👻", topics: ["The Haunted Lighthouse", "Whispers in the Walls", "The Shadow That Followed"] },
  { id: "history", label: "History & Facts", icon: "📜", topics: ["How the Pyramids Were Built", "The Lost City of Atlantis", "Secrets of the Roman Empire"] },
  { id: "science", label: "Science & Nature", icon: "🔬", topics: ["What Lives in the Deep Ocean", "How Black Holes Work", "The Secret Life of Trees"] },
  { id: "kids", label: "Kids Stories", icon: "🧸", topics: ["A Rabbit Who Found a Magic Flower", "The Dragon Who Was Afraid of Fire", "The Little Star That Got Lost"] },
  { id: "motivation", label: "Motivational", icon: "🔥", topics: ["Why Failure Is Your Best Teacher", "The Power of Showing Up Every Day", "How to Build Unshakable Confidence"] },
  { id: "custom", label: "Custom Topic", icon: "✏️", topics: [] },
];

const STYLES = [
  { id: "ghibli", label: "Studio Ghibli", desc: "Warm, hand-painted anime aesthetic", image: "/styles/ghibli.jpg" },
  { id: "anime", label: "Modern Anime", desc: "Vibrant, crisp anime illustration", image: "/styles/anime.jpg" },
  { id: "cartoon", label: "Cartoon", desc: "Bold, playful Pixar-inspired", image: "/styles/cartoon.jpg" },
  { id: "comic", label: "Comic Book", desc: "Bold outlines, halftone dots", image: "/styles/comic.jpg" },
  { id: "realistic", label: "Cinematic", desc: "Photorealistic, dramatic lighting", image: "/styles/realistic.jpg" },
  { id: "watercolor", label: "Watercolor", desc: "Soft, dreamy brush strokes", image: "/styles/watercolor.jpg" },
];

const VOICES = [
  { id: "jack", label: "Jack", desc: "Male · American · Deep narrator", file: "/voices/jack.mp3" },
  { id: "emma", label: "Emma", desc: "Female · American · Warm", file: "/voices/emma.mp3" },
  { id: "andrew", label: "Andrew", desc: "Male · American · Natural", file: "/voices/andrew.mp3" },
  { id: "aria", label: "Aria", desc: "Female · American · Expressive", file: "/voices/aria.mp3" },
  { id: "ryan", label: "Ryan", desc: "Male · British · Dramatic", file: "/voices/ryan.mp3" },
  { id: "sonia", label: "Sonia", desc: "Female · British · Elegant", file: "/voices/sonia.mp3" },
];

const MUSIC_TRACKS = [
  { id: "none", label: "No Music", desc: "Voice only", color: "bg-gray-700" },
  { id: "happy-rhythm", label: "Happy Rhythm", desc: "Upbeat and energetic, perfect for positive content", color: "bg-amber-500", file: "/music/happy-rhythm.mp3" },
  { id: "suspenseful", label: "Quiet Before Storm", desc: "Building tension and anticipation for dramatic reveals", color: "bg-indigo-600", file: "/music/suspenseful.mp3" },
  { id: "peaceful", label: "Peaceful Vibes", desc: "Calm and soothing background for relaxed storytelling", color: "bg-emerald-500", file: "/music/peaceful.mp3" },
  { id: "epic-cinematic", label: "Epic Cinematic", desc: "Orchestral and majestic for epic storytelling", color: "bg-purple-600", file: "/music/epic-cinematic.mp3" },
  { id: "mysterious", label: "Breathing Shadows", desc: "Mysterious and eerie ambiance for suspenseful videos", color: "bg-slate-600", file: "/music/mysterious.mp3" },
  { id: "energetic", label: "High Energy", desc: "Fast-paced pulse for action-packed content", color: "bg-red-500", file: "/music/energetic.mp3" },
];

const TEXT_STYLES = [
  { id: "bold-stroke", label: "Bold Stroke", desc: "Clean white text, thick black outline", preview: { color: "#fff", stroke: "#000", bg: false } },
  { id: "red-highlight", label: "Red Highlight", desc: "White text on red highlighted background", preview: { color: "#fff", stroke: "none", bg: true, bgColor: "#dc2626" } },
  { id: "karaoke", label: "Karaoke", desc: "Word-by-word highlight as narrator speaks", preview: { color: "#facc15", stroke: "#000", bg: false } },
  { id: "sleek", label: "Sleek", desc: "Subtle gray text, minimal and modern", preview: { color: "#d1d5db", stroke: "none", bg: false } },
  { id: "beast", label: "Beast", desc: "Large bold red text, impact style", preview: { color: "#ef4444", stroke: "#000", bg: false } },
  { id: "elegant", label: "Elegant", desc: "Refined serif-style, warm gold tones", preview: { color: "#fbbf24", stroke: "#78350f", bg: false } },
];

const DURATIONS = [
  { value: 10, label: "10s", desc: "Quick hook" },
  { value: 15, label: "15s", desc: "Short reel" },
  { value: 30, label: "30s", desc: "Standard" },
  { value: 60, label: "60s", desc: "Long form" },
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function FacelessPage() {
  const router = useRouter();

  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("ghibli");
  const [voice, setVoice] = useState("andrew");
  const [music, setMusic] = useState("none");
  const [textStyle, setTextStyle] = useState("bold-stroke");
  const [duration, setDuration] = useState(30);
  const [count, setCount] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  function handleCategoryClick(catId: string) {
    setCategory(catId);
    if (catId !== "custom") {
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat && cat.topics.length > 0) setTopic(cat.topics[Math.floor(Math.random() * cat.topics.length)]);
    } else {
      setTopic("");
    }
  }

  function playAudio(id: string, file: string) {
    audioRef.current?.pause();
    audioRef.current = null;
    if (playingAudio === id) { setPlayingAudio(null); return; }
    const audio = new Audio(file);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    audioRef.current = audio;
    setPlayingAudio(id);
  }

  async function handleSubmit() {
    if (!topic.trim()) { setError("Please enter a topic"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/faceless/submit", {
        topic: topic.trim(),
        style,
        voice,
        music,
        text_style: textStyle,
        duration,
        count: 1, // Always 1 for now
      });
      const jobIds: string[] = res.data.job_ids;
      router.push(jobIds.length === 1 ? `/dashboard/jobs/${jobIds[0]}` : "/dashboard");
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to create video. Try again.");
      setSubmitting(false);
    }
  }

  const selectedCat = CATEGORIES.find((c) => c.id === category);

  /* Play/pause button SVG */
  const PlayBtn = ({ id, file }: { id: string; file: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); playAudio(id, file); }}
      className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
    >
      {playingAudio === id ? (
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Faceless Video</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI generates script, images, voiceover, and assembles a ready-to-post reel
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/50 border border-red-800 text-red-300 text-sm">{error}</div>
      )}

      {/* ── 1. Category ───────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">1. Pick a Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                category === cat.id
                  ? "bg-indigo-900/60 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="truncate">{cat.label}</span>
            </button>
          ))}
        </div>
        {selectedCat && selectedCat.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedCat.topics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  topic === t ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Describe your video topic..."
          className="mt-3 w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </section>

      {/* ── 2. Visual Style ───────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">2. Visual Style</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                style === s.id ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-gray-800 hover:border-gray-600"
              }`}
            >
              <div className="h-32 overflow-hidden">
                <img src={s.image} alt={s.label} className="w-full h-full object-cover" />
              </div>
              <div className="p-3 bg-gray-900">
                <p className="text-sm font-semibold text-white">{s.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
              {style === s.id && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── 3. Voice ──────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">3. Voice</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {VOICES.map((v) => (
            <div
              key={v.id}
              onClick={() => setVoice(v.id)}
              className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                voice === v.id ? "border-indigo-500 bg-indigo-950/30" : "border-gray-800 bg-gray-900 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{v.label}</span>
                <PlayBtn id={`voice-${v.id}`} file={v.file} />
              </div>
              <p className="text-xs text-gray-500">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Background Music ───────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          4. Background Music <span className="text-gray-600 normal-case font-normal">Optional</span>
        </h2>
        <div className="space-y-2">
          {MUSIC_TRACKS.map((m) => (
            <div
              key={m.id}
              onClick={() => setMusic(m.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                music === m.id ? "border-indigo-500 bg-indigo-950/20" : "border-gray-800 bg-gray-900 hover:border-gray-600"
              }`}
            >
              {/* Color swatch */}
              <div className={`w-10 h-10 rounded-lg ${m.color} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{m.label}</p>
                <p className="text-xs text-gray-500 truncate">{m.desc}</p>
              </div>
              {m.file && <PlayBtn id={`music-${m.id}`} file={m.file} />}
              {music === m.id && (
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Text / Subtitle Style ──────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">5. Text Style</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEXT_STYLES.map((ts) => (
            <button
              key={ts.id}
              onClick={() => setTextStyle(ts.id)}
              className={`rounded-xl border-2 overflow-hidden transition-all ${
                textStyle === ts.id ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-gray-800 hover:border-gray-600"
              }`}
            >
              {/* Preview bar */}
              <div className="h-16 bg-gray-800 flex items-center justify-center relative">
                {ts.preview.bg && (
                  <span
                    className="px-3 py-1 rounded text-sm font-bold"
                    style={{ backgroundColor: ts.preview.bgColor, color: ts.preview.color }}
                  >
                    SAMPLE
                  </span>
                )}
                {!ts.preview.bg && (
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: ts.preview.color,
                      WebkitTextStroke: ts.preview.stroke !== "none" ? `2px ${ts.preview.stroke}` : undefined,
                      paintOrder: "stroke fill",
                    }}
                  >
                    SAMPLE TEXT
                  </span>
                )}
              </div>
              <div className="p-2.5 bg-gray-900">
                <p className="text-xs font-semibold text-white">{ts.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{ts.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── 6. Duration & Count ───────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">6. Duration & Quantity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Video Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    duration === d.value
                      ? "bg-indigo-900/60 border-indigo-500 text-white"
                      : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div>{d.label}</div>
                  <div className="text-[10px] opacity-60">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">
              How many videos? <span className="text-gray-600">(coming soon)</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  disabled={n > 1}
                  onClick={() => n === 1 && setCount(n)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    count === n
                      ? "bg-indigo-900/60 border-indigo-500 text-white"
                      : n > 1
                        ? "bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed"
                        : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !topic.trim()}
        className={`w-full py-4 rounded-xl text-base font-semibold transition-all ${
          submitting || !topic.trim()
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/30"
        }`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creating video...
          </span>
        ) : (
          "Generate Video"
        )}
      </button>

      <p className="text-center text-xs text-gray-600 mt-3">
        Each video uses 1 credit from your monthly limit
      </p>
    </div>
  );
}
