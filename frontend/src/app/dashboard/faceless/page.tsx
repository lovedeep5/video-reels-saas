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
  {
    id: "ghibli", label: "Studio Ghibli",
    desc: "Warm, hand-painted anime aesthetic",
    gradient: "from-emerald-800 via-teal-700 to-sky-600",
    preview: "🌿",
  },
  {
    id: "anime", label: "Modern Anime",
    desc: "Vibrant, crisp anime illustration",
    gradient: "from-violet-700 via-fuchsia-600 to-pink-500",
    preview: "⚡",
  },
  {
    id: "cartoon", label: "Cartoon",
    desc: "Bold, playful Pixar-inspired",
    gradient: "from-amber-600 via-orange-500 to-red-500",
    preview: "🎨",
  },
  {
    id: "comic", label: "Comic Book",
    desc: "Bold outlines, halftone dots",
    gradient: "from-red-700 via-yellow-500 to-blue-600",
    preview: "💥",
  },
  {
    id: "realistic", label: "Cinematic",
    desc: "Photorealistic, dramatic lighting",
    gradient: "from-gray-900 via-slate-700 to-gray-500",
    preview: "🎬",
  },
  {
    id: "watercolor", label: "Watercolor",
    desc: "Soft, dreamy brush strokes",
    gradient: "from-rose-400 via-pink-300 to-purple-300",
    preview: "🎭",
  },
];

const VOICES = [
  { id: "jack", label: "Jack", desc: "Male · American · Deep narrator", file: "/voices/jack.mp3" },
  { id: "emma", label: "Emma", desc: "Female · American · Warm", file: "/voices/emma.mp3" },
  { id: "andrew", label: "Andrew", desc: "Male · American · Natural", file: "/voices/andrew.mp3" },
  { id: "aria", label: "Aria", desc: "Female · American · Expressive", file: "/voices/aria.mp3" },
  { id: "ryan", label: "Ryan", desc: "Male · British · Dramatic", file: "/voices/ryan.mp3" },
  { id: "sonia", label: "Sonia", desc: "Female · British · Elegant", file: "/voices/sonia.mp3" },
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

  // Form state
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("ghibli");
  const [voice, setVoice] = useState("andrew");
  const [duration, setDuration] = useState(30);
  const [count, setCount] = useState(1);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function handleCategoryClick(catId: string) {
    setCategory(catId);
    if (catId !== "custom") {
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat && cat.topics.length > 0) {
        setTopic(cat.topics[Math.floor(Math.random() * cat.topics.length)]);
      }
    } else {
      setTopic("");
    }
  }

  function playVoice(voiceId: string, file: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      return;
    }
    const audio = new Audio(file);
    audio.onended = () => setPlayingVoice(null);
    audio.play();
    audioRef.current = audio;
    setPlayingVoice(voiceId);
  }

  async function handleSubmit() {
    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/faceless/submit", {
        topic: topic.trim(),
        style,
        voice,
        duration,
        count,
      });
      const jobIds: string[] = res.data.job_ids;
      // Navigate to the first job (or dashboard if multiple)
      if (jobIds.length === 1) {
        router.push(`/dashboard/jobs/${jobIds[0]}`);
      } else {
        router.push("/dashboard");
      }
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to create video. Try again.");
      setSubmitting(false);
    }
  }

  const selectedCat = CATEGORIES.find((c) => c.id === category);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Faceless Video</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI generates script, images, voiceover, and assembles a ready-to-post reel
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/50 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Step 1: Category ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          1. Pick a Category
        </h2>
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

        {/* Topic suggestions */}
        {selectedCat && selectedCat.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedCat.topics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  topic === t
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Topic input */}
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Describe your video topic..."
          className="mt-3 w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </section>

      {/* ── Step 2: Style ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          2. Choose Visual Style
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                style === s.id
                  ? "border-indigo-500 ring-2 ring-indigo-500/30"
                  : "border-gray-800 hover:border-gray-600"
              }`}
            >
              {/* Gradient preview */}
              <div className={`h-24 bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
                <span className="text-4xl drop-shadow-lg">{s.preview}</span>
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

      {/* ── Step 3: Voice ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          3. Select Voice
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {VOICES.map((v) => (
            <div
              key={v.id}
              onClick={() => setVoice(v.id)}
              className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                voice === v.id
                  ? "border-indigo-500 bg-indigo-950/30"
                  : "border-gray-800 bg-gray-900 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{v.label}</span>
                {/* Play button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playVoice(v.id, v.file);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                  title={`Play ${v.label}'s voice`}
                >
                  {playingVoice === v.id ? (
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
              </div>
              <p className="text-xs text-gray-500">{v.desc}</p>
              {voice === v.id && (
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs text-indigo-400">Selected</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Step 4: Duration & Count ──────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          4. Duration & Quantity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Duration */}
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

          {/* Count */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">How many videos?</label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    count === n
                      ? "bg-indigo-900/60 border-indigo-500 text-white"
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
            Creating {count > 1 ? `${count} videos` : "video"}...
          </span>
        ) : (
          `Generate ${count > 1 ? `${count} Videos` : "Video"}`
        )}
      </button>

      <p className="text-center text-xs text-gray-600 mt-3">
        Each video uses 1 credit from your monthly limit
      </p>
    </div>
  );
}
