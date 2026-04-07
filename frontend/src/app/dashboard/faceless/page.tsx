"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api, { youtubeApi, instagramApi, automationsApi, ChannelInfo } from "@/lib/api";

/* ── Constants ───────────────────────────────────────────────────────────── */

const SCRIPT_TYPES = [
  { id: "story",      label: "Story",      icon: "📖" },
  { id: "facts",      label: "Facts",       icon: "💡" },
  { id: "explainer",  label: "Explainer",   icon: "🔍" },
  { id: "listicle",   label: "Top List",    icon: "📋" },
  { id: "horror",     label: "Horror",      icon: "👻" },
  { id: "motivation", label: "Motivation",  icon: "🔥" },
];

const STYLES = [
  { id: "comic",          label: "Comic",          image: "/styles/comic.webp" },
  { id: "creepy-comic",   label: "Creepy Comic",   image: "/styles/creepy-comic.webp" },
  { id: "modern-cartoon", label: "Modern Cartoon", image: "/styles/modern-cartoon.webp" },
  { id: "disney",         label: "Disney",         image: "/styles/disney.webp" },
  { id: "ghibli",         label: "Ghibli",         image: "/styles/ghibli.webp" },
  { id: "anime",          label: "Anime",          image: "/styles/anime.webp" },
  { id: "painting",       label: "Painting",       image: "/styles/painting.webp" },
  { id: "dark-fantasy",   label: "Dark Fantasy",   image: "/styles/dark-fantasy.webp" },
  { id: "lego",           label: "Lego",           image: "/styles/lego.webp" },
  { id: "polaroid",       label: "Polaroid",       image: "/styles/polaroid.webp" },
  { id: "realistic",      label: "Realism",        image: "/styles/realistic.webp" },
  { id: "fantastic",      label: "Fantastic",      image: "/styles/fantastic.webp" },
];

const ALL_VOICES = [
  { id: "jack",        label: "Jack",        desc: "Male · Deep narrator",          lang: "en",    group: "Natural",  file: "/voices/jack.mp3" },
  { id: "emma",        label: "Emma",        desc: "Female · Warm storyteller",     lang: "en",    group: "Natural",  file: "/voices/emma.mp3" },
  { id: "andrew",      label: "Andrew",      desc: "Male · Clear, natural",         lang: "en",    group: "Natural",  file: "/voices/andrew.mp3" },
  { id: "aria",        label: "Aria",        desc: "Female · Expressive",           lang: "en",    group: "Natural",  file: "/voices/aria.mp3" },
  { id: "ryan",        label: "Ryan",        desc: "Male · British dramatic",       lang: "en",    group: "Natural",  file: "/voices/ryan.mp3" },
  { id: "sonia",       label: "Sonia",       desc: "Female · British elegant",      lang: "en",    group: "Natural",  file: "/voices/sonia.mp3" },
  { id: "brian",       label: "Brian",       desc: "Male · Clear narrator",         lang: "en",    group: "Natural",  file: "/voices/brian.mp3" },
  { id: "ava",         label: "Ava",         desc: "Female · Smooth",               lang: "en",    group: "Natural",  file: "/voices/ava.mp3" },
  { id: "christopher", label: "Christopher", desc: "Male · Authoritative",          lang: "en",    group: "Natural",  file: "/voices/christopher.mp3" },
  { id: "roger",       label: "Roger",       desc: "Male · Deep, commanding",       lang: "en",    group: "Natural",  file: "/voices/roger.mp3" },
  { id: "phantom",     label: "Phantom",     desc: "Male · Dark measured narrator", lang: "en",    group: "Horror",   file: "/voices/phantom.mp3" },
  { id: "whisper",     label: "Whisper",     desc: "Female · Eerie, unsettling",    lang: "en",    group: "Horror",   file: "/voices/whisper.mp3" },
  { id: "shadow",      label: "Shadow",      desc: "Male · Dark British",           lang: "en",    group: "Horror",   file: "/voices/shadow.mp3" },
  { id: "dread",       label: "Dread",       desc: "Male · Ominous deep voice",     lang: "en",    group: "Horror",   file: "/voices/dread.mp3" },
  { id: "crypt",       label: "Crypt",       desc: "Male · Cold, unsettling",       lang: "en",    group: "Horror",   file: "/voices/crypt.mp3" },
  { id: "madhur",      label: "Madhur",      desc: "Male · Hindi narrator",         lang: "hi",    group: "Hindi",    file: "/voices/madhur.mp3" },
  { id: "swara",       label: "Swara",       desc: "Female · Hindi (best quality)", lang: "hi",    group: "Hindi",    file: "/voices/swara.mp3" },
  { id: "bhoot",       label: "Bhoot",       desc: "Male · Hindi dark narrator",    lang: "hi",    group: "Hindi",    file: "/voices/bhoot.mp3" },
  { id: "prabhat",     label: "Prabhat",     desc: "Male · Indian English",         lang: "en-in", group: "Indian English", file: "/voices/prabhat.mp3" },
  { id: "neerja",      label: "Neerja",      desc: "Female · Indian English",       lang: "en-in", group: "Indian English", file: "/voices/neerja.mp3" },
];

const MUSIC_TRACKS = [
  { id: "none",             label: "No Music",         color: "bg-gray-600" },
  { id: "upbeat-happy",     label: "Upbeat Happy",     color: "bg-amber-500",   file: "/music/upbeat-happy.mp3" },
  { id: "epic-cinematic",   label: "Epic Cinematic",   color: "bg-purple-500",  file: "/music/epic-cinematic.mp3" },
  { id: "dark-suspense",    label: "Dark Suspense",    color: "bg-slate-600",   file: "/music/dark-suspense.mp3" },
  { id: "emotional-piano",  label: "Emotional Piano",  color: "bg-sky-500",     file: "/music/emotional-piano.mp3" },
  { id: "chill-lounge",     label: "Chill Lounge",     color: "bg-emerald-500", file: "/music/chill-lounge.mp3" },
  { id: "motivation-rock",  label: "Motivation Rock",  color: "bg-red-500",     file: "/music/motivation-rock.mp3" },
  { id: "fantasy-orchestra",label: "Fantasy Orchestra",color: "bg-violet-500",  file: "/music/fantasy-orchestra.mp3" },
  { id: "dark-cyberpunk",   label: "Dark Cyberpunk",   color: "bg-cyan-600",    file: "/music/dark-cyberpunk.mp3" },
  { id: "nature-ambient",   label: "Nature Ambient",   color: "bg-green-600",   file: "/music/nature-ambient.mp3" },
  { id: "groovy-trap",      label: "Groovy Trap",      color: "bg-pink-500",    file: "/music/groovy-trap.mp3" },
  { id: "energetic-action", label: "Energetic Action", color: "bg-orange-500",  file: "/music/energetic-action.mp3" },
  { id: "slow-motion",      label: "Slow Motion",      color: "bg-indigo-400",  file: "/music/slow-motion.mp3" },
];

const TEXT_STYLES = [
  { id: "bold-stroke",   label: "Bold" },
  { id: "red-highlight", label: "Highlight" },
  { id: "karaoke",       label: "Karaoke" },
  { id: "sleek",         label: "Sleek" },
  { id: "beast",         label: "Beast" },
  { id: "elegant",       label: "Elegant" },
];

const STEP_TITLES = ["Your Idea", "Look & Sound", "Publish"];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function Btn({ children, active, onClick, className = "" }: { children: React.ReactNode; active?: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-md text-xs font-medium border transition-all ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function CreateVideoPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1
  const [topic, setTopic]           = useState("");
  const [scriptType, setScriptType] = useState("story");
  const [duration, setDuration]     = useState(30);
  const [language, setLanguage]     = useState("en");
  const [suggestions, setSuggestions]       = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Step 2
  const [style, setStyle]       = useState("ghibli");
  const [voice, setVoice]       = useState("andrew");
  const [music, setMusic]       = useState("none");
  const [textStyle, setTextStyle] = useState("bold-stroke");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Step 3
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 3_600_000);
    return d.toISOString().slice(0, 16);
  });
  const [ytChannels, setYtChannels] = useState<ChannelInfo[]>([]);
  const [igChannels, setIgChannels] = useState<ChannelInfo[]>([]);
  const [autoYt, setAutoYt]           = useState(false);
  const [autoIg, setAutoIg]           = useState(false);
  const [autoYtChannel, setAutoYtChannel] = useState("");
  const [autoIgChannel, setAutoIgChannel] = useState("");
  const [visibility, setVisibility]   = useState("public");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

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

  async function fetchSuggestions() {
    if (!topic.trim() && !scriptType) return;
    setLoadingSuggestions(true);
    try {
      const r = await api.post("/faceless/suggestions", { category: topic.slice(0, 60), script_type: scriptType });
      setSuggestions(r.data.suggestions || []);
    } catch { /* non-fatal */ } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleSubmit() {
    setError("");
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) { setError("Please describe your video idea"); return; }

    const platforms: { platform: string; channel_id: string }[] = [];
    if (autoYt && autoYtChannel) platforms.push({ platform: "youtube", channel_id: autoYtChannel });
    if (autoIg && autoIgChannel) platforms.push({ platform: "instagram", channel_id: autoIgChannel });

    setSubmitting(true);
    try {
      const res = await api.post("/faceless/submit", {
        topic: trimmedTopic,
        script_type: scriptType,
        style,
        voice,
        music,
        text_style: textStyle,
        duration,
        count: 1,
        ...(platforms.length > 0 ? {
          auto_publish: {
            platforms,
            visibility,
            ...(publishMode === "schedule" ? { scheduled_at: new Date(scheduleDate).toISOString() } : {}),
          },
        } : {}),
      });
      const jobIds: string[] = res.data.job_ids;
      router.push(jobIds.length === 1 ? `/dashboard/jobs/${jobIds[0]}` : "/dashboard");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Failed to create video. Please try again.");
      setSubmitting(false);
    }
  }

  const voiceGroups = ["Natural", "Horror", "Hindi", "Indian English"];
  const selectedVoice = ALL_VOICES.find((v) => v.id === voice);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-purple-900/50 border border-purple-800/50 flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Create AI Video</h1>
          <p className="text-xs text-gray-500">AI writes, designs, and narrates your video</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_TITLES.map((title, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-1.5 ${i <= step ? "text-white" : "text-gray-600"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${
                i < step ? "bg-indigo-600 border-indigo-600" : i === step ? "border-indigo-500 text-indigo-400" : "border-gray-700"
              }`}>
                {i < step ? (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                ) : (i + 1)}
              </div>
              <span className="text-xs font-medium hidden sm:block">{title}</span>
            </div>
            {i < STEP_TITLES.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? "bg-indigo-600" : "bg-gray-800"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-900 text-red-300 text-sm">{error}</div>
      )}

      {/* ── Step 0: Idea ──────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Describe your video idea</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="e.g. The story of Hanuman lifting the Sanjeevani mountain, or the Iran-USA tensions in 2025, or 5 terrifying facts about the deep ocean..."
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-gray-600">Be specific — the AI will search for facts and generate accurate visuals</p>
              <button
                type="button"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {loadingSuggestions ? "Getting ideas..." : "✨ Get ideas"}
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => setTopic(s)}
                    className="text-xs px-2.5 py-1 rounded-md border border-purple-800/60 text-purple-400 hover:border-purple-600 hover:text-purple-300 transition-colors"
                  >{s}</button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Script format</label>
            <div className="flex flex-wrap gap-1.5">
              {SCRIPT_TYPES.map((st) => (
                <Btn key={st.id} active={scriptType === st.id} onClick={() => setScriptType(st.id)}>
                  {st.icon} {st.label}
                </Btn>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 block">Duration</label>
              <div className="flex gap-1.5">
                {[15, 30, 60].map((d) => (
                  <Btn key={d} active={duration === d} onClick={() => setDuration(d)}>{d}s</Btn>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 block">Language</label>
              <div className="flex gap-1.5">
                {[{ id: "en", label: "English" }, { id: "hi", label: "Hindi" }].map((l) => (
                  <Btn key={l.id} active={language === l.id} onClick={() => setLanguage(l.id)}>{l.label}</Btn>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Look & Sound ──────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Visual style */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-3 block">Visual style</label>
            <div className="grid grid-cols-4 gap-2">
              {STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setStyle(s.id)}
                  className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                    style === s.id ? "border-indigo-500" : "border-gray-800 hover:border-gray-600"
                  }`}
                >
                  <div className="aspect-[3/4]">
                    <img src={s.image} alt={s.label} className="w-full h-full object-cover" />
                  </div>
                  {style === s.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                  )}
                  <p className={`text-[10px] font-medium py-1 text-center ${style === s.id ? "text-white bg-indigo-900/60" : "text-gray-500"}`}>{s.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Narrator voice</label>
            <details className="group">
              <summary className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors list-none">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-900/60 border border-indigo-800/60 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {selectedVoice?.label[0] ?? "A"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedVoice?.label}</p>
                    <p className="text-xs text-gray-500">{selectedVoice?.desc}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div className="mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                {voiceGroups.map((group) => {
                  const groupVoices = ALL_VOICES.filter((v) => v.group === group);
                  if (!groupVoices.length) return null;
                  return (
                    <div key={group}>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600 px-4 py-1.5 border-b border-gray-800 font-semibold">{group}</p>
                      {groupVoices.map((v) => (
                        <button key={v.id} type="button" onClick={() => { setVoice(v.id); setLanguage(v.lang); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-800/50 ${voice === v.id ? "bg-indigo-950/30" : ""}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${voice === v.id ? "border-indigo-500 bg-indigo-500" : "border-gray-600"}`}>
                            {voice === v.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white">{v.label}</span>
                            <span className="text-xs text-gray-500 ml-2">{v.desc}</span>
                          </div>
                          {v.file && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); playAudio(v.id, v.file); }}
                              className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center flex-shrink-0 transition-colors"
                            >
                              {playingAudio === v.id
                                ? <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                                : <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              }
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

          {/* Music */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Background music</label>
            <select
              value={music}
              onChange={(e) => setMusic(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {MUSIC_TRACKS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Text style */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Caption style</label>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_STYLES.map((ts) => (
                <Btn key={ts.id} active={textStyle === ts.id} onClick={() => setTextStyle(ts.id)}>{ts.label}</Btn>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Publish ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* When */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">When to generate</label>
            <div className="flex gap-2">
              <Btn active={publishMode === "now"} onClick={() => setPublishMode("now")} className="flex-1 justify-center">Generate now</Btn>
              <Btn active={publishMode === "schedule"} onClick={() => setPublishMode("schedule")} className="flex-1 justify-center">Schedule later</Btn>
            </div>
          </div>

          {publishMode === "schedule" && (
            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 block">Schedule date & time</label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Publish channels */}
          {(ytChannels.length > 0 || igChannels.length > 0) && (
            <div>
              <label className="text-xs font-medium text-gray-400 mb-3 block">Auto-publish to (optional)</label>
              <div className="space-y-2">
                {ytChannels.length > 0 && (
                  <div className={`flex items-center gap-3 p-3.5 rounded-lg border transition-all ${autoYt ? "border-red-800 bg-red-950/20" : "border-gray-800"}`}>
                    <input type="checkbox" id="yt" checked={autoYt} onChange={(e) => setAutoYt(e.target.checked)} className="accent-red-500" />
                    <label htmlFor="yt" className="flex-1 text-sm font-medium text-white cursor-pointer">YouTube</label>
                    {autoYt && ytChannels.length > 1 && (
                      <select value={autoYtChannel} onChange={(e) => setAutoYtChannel(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        {ytChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {igChannels.length > 0 && (
                  <div className={`flex items-center gap-3 p-3.5 rounded-lg border transition-all ${autoIg ? "border-pink-800 bg-pink-950/20" : "border-gray-800"}`}>
                    <input type="checkbox" id="ig" checked={autoIg} onChange={(e) => setAutoIg(e.target.checked)} className="accent-pink-500" />
                    <label htmlFor="ig" className="flex-1 text-sm font-medium text-white cursor-pointer">Instagram</label>
                    {autoIg && igChannels.length > 1 && (
                      <select value={autoIgChannel} onChange={(e) => setAutoIgChannel(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        {igChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {(autoYt || autoIg) && (
                  <div className="flex gap-2 pt-1">
                    {["public", "private", "unlisted"].map((v) => (
                      <Btn key={v} active={visibility === v} onClick={() => setVisibility(v)} className="capitalize">{v}</Btn>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 space-y-1.5 text-xs text-gray-400">
            <p><span className="text-gray-300 font-medium">Topic:</span> {topic.slice(0, 80)}{topic.length > 80 ? "…" : ""}</p>
            <p><span className="text-gray-300 font-medium">Format:</span> {scriptType} · {duration}s · {language === "hi" ? "Hindi" : "English"}</p>
            <p><span className="text-gray-300 font-medium">Style:</span> {STYLES.find((s) => s.id === style)?.label} · {selectedVoice?.label} voice</p>
            <p><span className="text-gray-300 font-medium">Music:</span> {MUSIC_TRACKS.find((m) => m.id === music)?.label} · {TEXT_STYLES.find((t) => t.id === textStyle)?.label} captions</p>
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)}
            className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium hover:border-gray-500 hover:text-white transition-all"
          >Back</button>
        )}
        {step < 2 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 0 && !topic.trim()) { setError("Please describe your video idea"); return; }
              setError("");
              setStep(step + 1);
            }}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Creating video...</>
            ) : "✨ Create Video"}
          </button>
        )}
      </div>
    </div>
  );
}
