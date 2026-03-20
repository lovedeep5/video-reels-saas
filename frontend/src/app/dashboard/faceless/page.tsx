"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api, { youtubeApi, instagramApi, ChannelInfo } from "@/lib/api";

/* ── Data ────────────────────────────────────────────────────────────────── */

const SCRIPT_TYPES = [
  { id: "story", label: "Story", icon: "📖" },
  { id: "facts", label: "Facts", icon: "💡" },
  { id: "explainer", label: "Explainer", icon: "🔍" },
  { id: "listicle", label: "Top List", icon: "📋" },
  { id: "horror", label: "Horror", icon: "👻" },
  { id: "motivation", label: "Motivation", icon: "🔥" },
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
  { id: "modern-cartoon", label: "Modern Cartoon", image: "/styles/modern-cartoon.webp" },
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
  { id: "none", label: "No Music", desc: "Voice narration only", color: "bg-gray-600", file: undefined },
  { id: "happy-rhythm", label: "Happy Rhythm", desc: "Upbeat and energetic, perfect for positive content", color: "bg-amber-500", file: "/music/happy-rhythm.mp3" },
  { id: "suspenseful", label: "Quiet Before Storm", desc: "Building tension and anticipation for dramatic reveals", color: "bg-indigo-500", file: "/music/suspenseful.mp3" },
  { id: "peaceful", label: "Peaceful Vibes", desc: "Calm and soothing background for relaxed storytelling", color: "bg-emerald-500", file: "/music/peaceful.mp3" },
  { id: "epic-cinematic", label: "Brilliant Symphony", desc: "Orchestral and majestic for epic storytelling", color: "bg-purple-500", file: "/music/epic-cinematic.mp3" },
  { id: "mysterious", label: "Breathing Shadows", desc: "Mysterious and eerie ambiance for suspenseful videos", color: "bg-slate-500", file: "/music/mysterious.mp3" },
  { id: "energetic", label: "High Energy", desc: "Fast-paced pulse for action-packed content", color: "bg-red-500", file: "/music/energetic.mp3" },
];

const DURATIONS = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

/* ── Style Carousel ───────────────────────────────────────────────────── */

function StyleCarousel({ style, setStyle }: { style: string; setStyle: (s: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll, { passive: true });
    return () => { if (el) el.removeEventListener("scroll", checkScroll); };
  }, []);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">Choose the visual style for your video</p>
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 transition-all -ml-2 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
        )}
        {/* Right arrow */}
        {canScrollRight && (
          <button onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 transition-all -mr-2 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        )}
        {/* Scrollable row — hidden scrollbar */}
        <div ref={scrollRef}
          className="style-scroll flex gap-3 overflow-x-auto px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`.style-scroll::-webkit-scrollbar { display: none; }`}</style>
          {STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className="flex flex-col items-center shrink-0"
              style={{ width: "calc((100% - 36px) / 4)" , minWidth: 120 }}
            >
              <div className={`relative w-full overflow-hidden rounded-lg border-2 transition-all ${
                style === s.id ? "border-indigo-500" : "border-gray-800 hover:border-gray-700"
              }`}>
                <div className="aspect-[3/4]">
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
              <p className={`text-xs font-medium mt-1.5 ${style === s.id ? "text-white" : "text-gray-400"}`}>{s.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TOTAL_STEPS = 5;
const STEP_TITLES = ["Topic & Script", "Art Style", "Voice", "Background Music", "Generate"];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function FacelessPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [scriptType, setScriptType] = useState("story");
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("creepy-comic");
  const [voice, setVoice] = useState("andrew");
  const [music, setMusic] = useState("none");
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
    } else { setTopic(""); }
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
        text_style: "bold-stroke", duration, count: 1,
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

  function goNext() { if (canNext && step < TOTAL_STEPS - 1) setStep(step + 1); }
  function goBack() { if (step > 0) setStep(step - 1); }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Progress bars at top */}
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full flex-1 transition-all ${
            i <= step ? "bg-indigo-500" : "bg-gray-800"
          }`} />
        ))}
      </div>

      {/* Step header */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-white">{STEP_TITLES[step]}</h1>
        <span className="text-xs font-medium text-indigo-400 bg-indigo-950 border border-indigo-800 px-2 py-0.5 rounded-full">
          Step {step + 1} of {TOTAL_STEPS}
        </span>
      </div>

      {error && (
        <div className="mt-4 px-4 py-2.5 rounded-md bg-red-950/60 border border-red-900 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex gap-8 mt-5">
        {/* ── Left: Step content ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Step 0: Topic */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Script format</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCRIPT_TYPES.map((st) => (
                    <button key={st.id} onClick={() => setScriptType(st.id)}
                      className={`px-3.5 py-2 rounded-md text-xs font-medium transition-all border ${
                        scriptType === st.id
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                      }`}
                    >{st.icon} {st.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => handleCategoryClick(cat.id)}
                      className={`px-3.5 py-2 rounded-md text-xs font-medium transition-all border ${
                        category === cat.id
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >{cat.icon} {cat.label}</button>
                  ))}
                </div>
              </div>

              {selectedCat && selectedCat.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCat.topics.map((t) => (
                    <button key={t} onClick={() => setTopic(t)}
                      className={`text-xs px-3 py-1.5 rounded-md transition-all border ${
                        topic === t ? "bg-indigo-600/30 text-indigo-300 border-indigo-600" : "bg-transparent border-gray-700 text-gray-500 hover:text-gray-300"
                      }`}
                    >{t}</button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Your topic or prompt</label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 terrifying facts about the deep ocean..."
                  rows={3}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-md px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Duration</label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => setDuration(d.value)}
                      className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all border ${
                        duration === d.value
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-transparent border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >{d.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Art Style */}
          {step === 1 && <StyleCarousel style={style} setStyle={setStyle} />}

          {/* Step 2: Voice */}
          {step === 2 && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Pick the narrator voice</p>
              <div className="space-y-2">
                {VOICES.map((v) => (
                  <button key={v.id} onClick={() => setVoice(v.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      voice === v.id ? "border-indigo-500 bg-indigo-950/20" : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    {voice === v.id ? (
                      <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-700 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{v.label}</p>
                      <p className="text-xs text-gray-500">{v.desc}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); playAudio(`v-${v.id}`, v.file); }}
                      className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shrink-0 transition-colors"
                    >
                      {playingAudio === `v-${v.id}` ? (
                        <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Music */}
          {step === 3 && (
            <div>
              <p className="text-sm text-gray-400 mb-4">Choose background music for your video</p>
              <div className="space-y-2">
                {MUSIC_TRACKS.map((m) => (
                  <button key={m.id} onClick={() => setMusic(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      music === m.id ? "border-indigo-500 bg-indigo-950/20" : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${m.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{m.label}</p>
                      <p className="text-xs text-gray-500 truncate">{m.desc}</p>
                    </div>
                    {m.file && (
                      <button onClick={(e) => { e.stopPropagation(); playAudio(`m-${m.id}`, m.file!); }}
                        className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shrink-0 transition-colors"
                      >
                        {playingAudio === `m-${m.id}` ? (
                          <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>
                    )}
                    {music === m.id && (
                      <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Generate */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 mb-2">Review your settings and generate</p>

              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
                {[
                  ["Topic", topic],
                  ["Format", SCRIPT_TYPES.find(s => s.id === scriptType)?.label],
                  ["Style", selectedStyle?.label],
                  ["Voice", VOICES.find(v => v.id === voice)?.label],
                  ["Music", MUSIC_TRACKS.find(m => m.id === music)?.label],
                  ["Duration", `${duration}s`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white truncate ml-4 max-w-[60%] text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* Auto-post */}
              {(ytChannels.length > 0 || igChannels.length > 0) && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
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

              <button onClick={handleSubmit} disabled={submitting || !topic.trim()}
                className={`w-full py-3.5 rounded-lg text-sm font-semibold transition-all ${
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

          {/* Navigation — always visible except on last step */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-8">
              {step > 0 ? (
                <button onClick={goBack}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  Back
                </button>
              ) : <div />}
              <button onClick={goNext} disabled={!canNext}
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  canNext ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                Continue
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Phone preview ──────────────────────────────────── */}
        <div className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24">
            <div className="bg-gray-950 border border-gray-800 rounded-[20px] p-1.5 shadow-2xl">
              <div className="flex justify-center mb-1">
                <div className="w-16 h-1 rounded-full bg-gray-800" />
              </div>
              <div className="relative bg-black rounded-[16px] overflow-hidden aspect-[9/16]">
                {selectedStyle && (
                  <img src={selectedStyle.image} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1">
                  <div className="w-0.5 h-3 rounded-full bg-yellow-400" />
                  <span className="text-[7px] text-white/70 font-medium uppercase tracking-wider">
                    {topic ? topic.slice(0, 20) : "Your video"}
                  </span>
                </div>
                <div className="absolute bottom-5 inset-x-0 text-center px-2">
                  <p className="text-[9px] text-white font-bold leading-tight drop-shadow-lg">
                    {topic ? topic.split(" ").slice(0, 4).join(" ") : "Subtitle text"}
                  </p>
                  <p className="text-[9px] text-white font-bold leading-tight drop-shadow-lg">
                    {topic ? topic.split(" ").slice(4, 8).join(" ") : "appears here"}
                  </p>
                </div>
                <div className="absolute bottom-1.5 inset-x-0 flex justify-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`rounded-full ${i === 0 ? "w-2.5 h-0.5 bg-yellow-400" : "w-0.5 h-0.5 bg-white/30"}`} />
                  ))}
                </div>
              </div>
              <div className="flex justify-center mt-1">
                <div className="w-12 h-0.5 rounded-full bg-gray-800" />
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-600 mt-2">Preview</p>
          </div>
        </div>
      </div>
    </div>
  );
}
