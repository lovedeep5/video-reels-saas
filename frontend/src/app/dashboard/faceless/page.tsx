"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import api, { youtubeApi, instagramApi, YouTubeStatus, InstagramStatus, ChannelInfo } from "@/lib/api";

/* ── Data ────────────────────────────────────────────────────────────────── */

const SCRIPT_TYPES = [
  { id: "story", label: "Story", desc: "Narrative arc", icon: "📖" },
  { id: "facts", label: "Facts", desc: "Did you know...", icon: "💡" },
  { id: "explainer", label: "Explainer", desc: "How it works", icon: "🔍" },
  { id: "listicle", label: "Top List", desc: "Countdown", icon: "📋" },
  { id: "horror", label: "Horror", desc: "Suspense", icon: "👻" },
  { id: "motivation", label: "Motivation", desc: "Inspire", icon: "🔥" },
];

const CATEGORIES = [
  { id: "mythology", label: "Mythology", icon: "🏛️", topics: ["The Minotaur of Crete", "Thor vs the World Serpent", "The Story of Medusa"] },
  { id: "scary", label: "Scary", icon: "👻", topics: ["The Haunted Lighthouse", "Whispers in the Walls", "The Shadow That Followed"] },
  { id: "history", label: "History", icon: "📜", topics: ["How the Pyramids Were Built", "The Lost City of Atlantis", "Secrets of the Roman Empire"] },
  { id: "science", label: "Science", icon: "🔬", topics: ["What Lives in the Deep Ocean", "How Black Holes Work", "The Secret Life of Trees"] },
  { id: "kids", label: "Kids", icon: "🧸", topics: ["A Rabbit Who Found a Magic Flower", "The Dragon Who Was Afraid of Fire", "The Little Star That Got Lost"] },
  { id: "motivation", label: "Motivation", icon: "🔥", topics: ["Why Failure Is Your Best Teacher", "The Power of Showing Up Every Day", "How to Build Unshakable Confidence"] },
  { id: "custom", label: "Custom", icon: "✏️", topics: [] },
];

const STYLES = [
  { id: "comic", label: "Comic", image: "/styles/comic.webp" },
  { id: "creepy-comic", label: "Creepy Comic", image: "/styles/creepy-comic.webp" },
  { id: "modern-cartoon", label: "Cartoon", image: "/styles/modern-cartoon.webp" },
  { id: "disney", label: "Disney", image: "/styles/disney.webp" },
  { id: "ghibli", label: "Ghibli", image: "/styles/ghibli.webp" },
  { id: "anime", label: "Anime", image: "/styles/anime.webp" },
  { id: "painting", label: "Painting", image: "/styles/painting.webp" },
  { id: "dark-fantasy", label: "Dark Fantasy", image: "/styles/dark-fantasy.webp" },
  { id: "lego", label: "Lego", image: "/styles/lego.webp" },
  { id: "polaroid", label: "Polaroid", image: "/styles/polaroid.webp" },
  { id: "realistic", label: "Realism", image: "/styles/realistic.webp" },
  { id: "fantastic", label: "Fantastic", image: "/styles/fantastic.webp" },
];

const VOICES = [
  { id: "jack", label: "Jack", desc: "Male · American · Deep", file: "/voices/jack.mp3" },
  { id: "emma", label: "Emma", desc: "Female · American · Warm", file: "/voices/emma.mp3" },
  { id: "andrew", label: "Andrew", desc: "Male · American · Natural", file: "/voices/andrew.mp3" },
  { id: "aria", label: "Aria", desc: "Female · American · Expressive", file: "/voices/aria.mp3" },
  { id: "ryan", label: "Ryan", desc: "Male · British · Dramatic", file: "/voices/ryan.mp3" },
  { id: "sonia", label: "Sonia", desc: "Female · British · Elegant", file: "/voices/sonia.mp3" },
];

const MUSIC_TRACKS = [
  { id: "none", label: "No Music", color: "bg-gray-700" },
  { id: "happy-rhythm", label: "Happy", color: "bg-amber-500", file: "/music/happy-rhythm.mp3" },
  { id: "suspenseful", label: "Suspense", color: "bg-indigo-600", file: "/music/suspenseful.mp3" },
  { id: "peaceful", label: "Peaceful", color: "bg-emerald-500", file: "/music/peaceful.mp3" },
  { id: "epic-cinematic", label: "Epic", color: "bg-purple-600", file: "/music/epic-cinematic.mp3" },
  { id: "mysterious", label: "Mysterious", color: "bg-slate-600", file: "/music/mysterious.mp3" },
  { id: "energetic", label: "Energetic", color: "bg-red-500", file: "/music/energetic.mp3" },
];

const DURATIONS = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

const STEPS = ["Topic", "Style", "Voice & Audio", "Publish"];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function FacelessPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [scriptType, setScriptType] = useState("story");
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("ghibli");
  const [voice, setVoice] = useState("andrew");
  const [music, setMusic] = useState("none");
  const [textStyle, setTextStyle] = useState("bold-stroke");
  const [duration, setDuration] = useState(30);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-publish
  const [autoPublish, setAutoPublish] = useState(false);
  const [ytChannels, setYtChannels] = useState<ChannelInfo[]>([]);
  const [igChannels, setIgChannels] = useState<ChannelInfo[]>([]);
  const [autoYt, setAutoYt] = useState(false);
  const [autoIg, setAutoIg] = useState(false);
  const [autoYtChannel, setAutoYtChannel] = useState("");
  const [autoIgChannel, setAutoIgChannel] = useState("");
  const [autoVisibility, setAutoVisibility] = useState("public");

  useEffect(() => {
    youtubeApi.status().then((r) => {
      setYtChannels(r.data.channels ?? []);
      if (r.data.channels?.length) setAutoYtChannel(r.data.channels[0].id);
    }).catch(() => {});
    instagramApi.status().then((r) => {
      setIgChannels(r.data.channels ?? []);
      if (r.data.channels?.length) setAutoIgChannel(r.data.channels[0].id);
    }).catch(() => {});
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
      const platforms: { platform: string; channel_id: string }[] = [];
      if (autoPublish) {
        if (autoYt && autoYtChannel) platforms.push({ platform: "youtube", channel_id: autoYtChannel });
        if (autoIg && autoIgChannel) platforms.push({ platform: "instagram", channel_id: autoIgChannel });
      }
      const res = await api.post("/faceless/submit", {
        topic: topic.trim(), script_type: scriptType, style, voice, music,
        text_style: textStyle, duration, count: 1,
        ...(platforms.length > 0 ? { auto_publish: { platforms, visibility: autoVisibility } } : {}),
      });
      const jobIds: string[] = res.data.job_ids;
      router.push(jobIds.length === 1 ? `/dashboard/jobs/${jobIds[0]}` : "/dashboard");
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(e.response?.data?.error || "Failed to create video. Try again.");
      setSubmitting(false);
    }
  }

  const selectedCat = CATEGORIES.find((c) => c.id === category);
  const selectedStyle = STYLES.find((s) => s.id === style);
  const canNext = step === 0 ? topic.trim().length > 0 : true;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Create Video</h1>
        <p className="text-gray-500 text-sm mt-0.5">AI generates everything — you just pick the vibe</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => i <= step && setStep(i)} className="flex items-center gap-1">
            <div className={`h-1 rounded-sm transition-all ${
              i <= step ? "bg-indigo-500 w-12" : "bg-gray-800 w-8"
            }`} />
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">{STEPS[step]}</span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-md bg-red-950/60 border border-red-900 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex gap-6">
        {/* Left: Controls */}
        <div className="flex-1 min-w-0">

          {/* ── Step 0: Topic ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Script type */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">Script format</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCRIPT_TYPES.map((st) => (
                    <button key={st.id} onClick={() => setScriptType(st.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        scriptType === st.id
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                      }`}
                    >{st.icon} {st.label}</button>
                  ))}
                </div>
              </div>

              {/* Category quick picks */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => handleCategoryClick(cat.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        category === cat.id
                          ? "bg-gray-700 text-white"
                          : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                      }`}
                    >{cat.icon} {cat.label}</button>
                  ))}
                </div>
              </div>

              {/* Topic suggestions */}
              {selectedCat && selectedCat.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCat.topics.map((t) => (
                    <button key={t} onClick={() => setTopic(t)}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                        topic === t ? "bg-indigo-600/40 text-indigo-300 border border-indigo-600" : "bg-gray-800/50 text-gray-500 hover:text-gray-300 border border-transparent"
                      }`}
                    >{t}</button>
                  ))}
                </div>
              )}

              {/* Topic input */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">Your topic or prompt</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 terrifying facts about the deep ocean..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-800 rounded-md px-3.5 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-600 transition-colors resize-none"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">Duration</label>
                <div className="flex gap-1.5">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => setDuration(d.value)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 ${
                        duration === d.value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                      }`}
                    >{d.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Style ─────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <label className="text-xs text-gray-500 mb-3 block font-medium">Choose the visual style for your video</label>
              <div className="overflow-x-auto pb-2 -mx-1">
                <div className="flex gap-3 px-1" style={{ minWidth: "max-content" }}>
                  {STYLES.map((s) => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className="flex flex-col items-center gap-2 shrink-0"
                      style={{ width: 140 }}
                    >
                      <div className={`relative w-full overflow-hidden rounded-lg border-2 transition-all ${
                        style === s.id ? "border-indigo-500" : "border-gray-800 hover:border-gray-700"
                      }`}>
                        <div className="aspect-[3/4] overflow-hidden">
                          <img src={s.image} alt={s.label} className="w-full h-full object-cover" />
                        </div>
                        {style === s.id && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${style === s.id ? "text-white" : "text-gray-400"}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Voice & Audio ─────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Voice */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">Narrator voice</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VOICES.map((v) => (
                    <button key={v.id} onClick={() => setVoice(v.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-left transition-all ${
                        voice === v.id ? "border-indigo-500 bg-indigo-950/30" : "border-gray-800 bg-gray-900 hover:border-gray-700"
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); playAudio(`v-${v.id}`, v.file); }}
                        className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shrink-0"
                      >
                        {playingAudio === `v-${v.id}` ? (
                          <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                        ) : (
                          <svg className="w-3 h-3 text-gray-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{v.label}</p>
                        <p className="text-[10px] text-gray-500 truncate">{v.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Music */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">Background music</label>
                <div className="flex flex-wrap gap-1.5">
                  {MUSIC_TRACKS.map((m) => (
                    <button key={m.id} onClick={() => setMusic(m.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        music === m.id
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${m.color}`} />
                      {m.label}
                      {m.file && (
                        <span onClick={(e) => { e.stopPropagation(); playAudio(`m-${m.id}`, m.file!); }}
                          className="ml-0.5 opacity-60 hover:opacity-100"
                        >{playingAudio === `m-${m.id}` ? "||" : "▶"}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Publish ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-900 border border-gray-800 rounded-md p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Topic</span>
                  <span className="text-white truncate ml-4 max-w-[70%] text-right">{topic}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Format</span>
                  <span className="text-white">{SCRIPT_TYPES.find(s => s.id === scriptType)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Style</span>
                  <span className="text-white">{selectedStyle?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Voice</span>
                  <span className="text-white">{VOICES.find(v => v.id === voice)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="text-white">{duration}s</span>
                </div>
              </div>

              {/* Auto-post */}
              {(ytChannels.length > 0 || igChannels.length > 0) && (
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Auto-post when ready</p>
                      <p className="text-xs text-gray-500">Publish automatically after creation</p>
                    </div>
                    <button onClick={() => setAutoPublish(!autoPublish)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${autoPublish ? "bg-indigo-600" : "bg-gray-700"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoPublish ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  {autoPublish && (
                    <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                      {ytChannels.length > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={autoYt} onChange={(e) => setAutoYt(e.target.checked)} className="rounded bg-gray-800 border-gray-700 text-red-600" />
                          <span className="text-gray-300">YouTube</span>
                          {ytChannels.length > 1 && (
                            <select value={autoYtChannel} onChange={(e) => setAutoYtChannel(e.target.value)} className="ml-auto bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white">
                              {ytChannels.map((ch) => <option key={ch.id} value={ch.id}>{ch.account_name}</option>)}
                            </select>
                          )}
                        </label>
                      )}
                      {igChannels.length > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={autoIg} onChange={(e) => setAutoIg(e.target.checked)} className="rounded bg-gray-800 border-gray-700 text-pink-600" />
                          <span className="text-gray-300">Instagram</span>
                          {igChannels.length > 1 && (
                            <select value={autoIgChannel} onChange={(e) => setAutoIgChannel(e.target.value)} className="ml-auto bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white">
                              {igChannels.map((ch) => <option key={ch.id} value={ch.id}>{ch.account_name}</option>)}
                            </select>
                          )}
                        </label>
                      )}
                      {autoYt && (
                        <div className="flex items-center gap-2 pl-5">
                          <span className="text-xs text-gray-500">Visibility</span>
                          <select value={autoVisibility} onChange={(e) => setAutoVisibility(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white">
                            <option value="public">Public</option>
                            <option value="unlisted">Unlisted</option>
                            <option value="private">Private</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Generate button */}
              <button onClick={handleSubmit} disabled={submitting || !topic.trim()}
                className={`w-full py-3.5 rounded-md text-sm font-semibold transition-all ${
                  submitting || !topic.trim()
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating video...
                  </span>
                ) : "Generate Video"}
              </button>
              <p className="text-center text-xs text-gray-600">1 credit per video</p>
            </div>
          )}

          {/* Navigation */}
          {step < 3 && (
            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)}
                  className="px-5 py-2.5 rounded-md text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 transition-colors"
                >Back</button>
              )}
              <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext}
                className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all ${
                  canNext ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >Continue</button>
            </div>
          )}
        </div>

        {/* Right: Phone preview */}
        <div className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <div className="bg-gray-950 border border-gray-800 rounded-[20px] p-2 shadow-2xl">
              {/* Phone notch */}
              <div className="flex justify-center mb-1">
                <div className="w-20 h-1 rounded-full bg-gray-800" />
              </div>
              {/* Screen */}
              <div className="relative bg-black rounded-[14px] overflow-hidden aspect-[9/16]">
                {selectedStyle && (
                  <img src={selectedStyle.image} alt="" className="w-full h-full object-cover" />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {/* Title */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <div className="w-0.5 h-3 rounded-full bg-yellow-400" />
                  <span className="text-[8px] text-white/80 font-medium uppercase tracking-wider">
                    {topic ? topic.slice(0, 25) : "Your video"}
                  </span>
                </div>
                {/* Subtitle preview */}
                <div className="absolute bottom-6 inset-x-0 text-center px-3">
                  <p className="text-[10px] text-white font-bold leading-tight drop-shadow-lg">
                    {topic ? topic.split(" ").slice(0, 4).join(" ") : "Your subtitle text"}
                  </p>
                  <p className="text-[10px] text-white font-bold leading-tight drop-shadow-lg">
                    {topic ? topic.split(" ").slice(4, 8).join(" ") : "appears here"}
                  </p>
                </div>
                {/* Progress dots */}
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`rounded-full ${i === 0 ? "w-3 h-1 bg-yellow-400" : "w-1 h-1 bg-white/30"}`} />
                  ))}
                </div>
              </div>
              {/* Phone bottom bar */}
              <div className="flex justify-center mt-1.5 mb-0.5">
                <div className="w-16 h-1 rounded-full bg-gray-800" />
              </div>
            </div>
            {/* Labels */}
            <div className="mt-3 text-center">
              <p className="text-[10px] text-gray-600">Preview</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{selectedStyle?.label} style</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
