"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { automationsApi, Automation, youtubeApi, instagramApi, ChannelInfo } from "@/lib/api";

const STYLES_MAP: Record<string, string> = {
  "comic": "Comic", "creepy-comic": "Creepy Comic", "modern-cartoon": "Cartoon", "disney": "Disney",
  "ghibli": "Ghibli", "anime": "Anime", "painting": "Painting", "dark-fantasy": "Dark Fantasy",
  "lego": "Lego", "polaroid": "Polaroid", "realistic": "Realism", "fantastic": "Fantastic",
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function utcToLocal(hour: number): string {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AutomationsPage() {
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [ytChannels, setYtChannels] = useState<ChannelInfo[]>([]);
  const [igChannels, setIgChannels] = useState<ChannelInfo[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [scriptType, setScriptType] = useState("story");
  const [style, setStyle] = useState("creepy-comic");
  const [voice, setVoice] = useState("andrew");
  const [music, setMusic] = useState("none");
  const [duration, setDuration] = useState(30);
  const [postHour, setPostHour] = useState(10);
  const [selYt, setSelYt] = useState(false);
  const [selIg, setSelIg] = useState(false);
  const [ytChannel, setYtChannel] = useState("");
  const [igChannel, setIgChannel] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = () => {
    automationsApi.list().then((r) => { setItems(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    youtubeApi.status().then((r) => {
      setYtChannels(r.data.channels ?? []);
      if (r.data.channels?.length) setYtChannel(r.data.channels[0].id);
    }).catch(() => {});
    instagramApi.status().then((r) => {
      setIgChannels(r.data.channels ?? []);
      if (r.data.channels?.length) setIgChannel(r.data.channels[0].id);
    }).catch(() => {});
  }, []);

  async function handleCreate() {
    const topics = topicsText.split("\n").map((t) => t.trim()).filter(Boolean);
    if (!name.trim()) { setError("Name required"); return; }
    if (topics.length === 0) { setError("At least 1 topic required"); return; }
    const platforms: { platform: string; channel_id: string }[] = [];
    if (selYt && ytChannel) platforms.push({ platform: "youtube", channel_id: ytChannel });
    if (selIg && igChannel) platforms.push({ platform: "instagram", channel_id: igChannel });
    if (platforms.length === 0) { setError("Select at least 1 channel"); return; }

    setError("");
    setSubmitting(true);
    try {
      await automationsApi.create({
        name: name.trim(), topics, script_type: scriptType, style, voice, music, duration,
        post_hour: postHour, platforms, visibility,
      });
      setCreating(false);
      setName(""); setTopicsText(""); setSelYt(false); setSelIg(false);
      fetchData();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(e.response?.data?.error || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    await automationsApi.toggle(id, !active);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this automation? Pending runs will be cancelled.")) return;
    await automationsApi.delete(id);
    fetchData();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Automations</h1>
          <p className="text-gray-500 text-sm">Set it once — AI creates and posts videos daily</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >+ New Automation</button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">Create Automation</h2>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Horror Stories"
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Topics (one per line — rotates daily)</label>
            <textarea value={topicsText} onChange={(e) => setTopicsText(e.target.value)} rows={4}
              placeholder={"5 terrifying facts about the deep ocean\nThe most haunted places on Earth\nCreepy unsolved mysteries"}
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
            <p className="text-[10px] text-gray-600 mt-1">{topicsText.split("\n").filter((t) => t.trim()).length} topics — cycles through 1 per day</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Script</label>
              <select value={scriptType} onChange={(e) => setScriptType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm text-white">
                {["story", "facts", "explainer", "listicle", "horror", "motivation"].map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm text-white">
                {Object.entries(STYLES_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Voice</label>
              <select value={voice} onChange={(e) => setVoice(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm text-white">
                {["jack", "emma", "andrew", "aria", "ryan", "sonia"].map((v) => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Duration</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm text-white">
                {[10, 15, 30, 60].map((d) => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Post every day at (UTC)</label>
            <select value={postHour} onChange={(e) => setPostHour(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm text-white">
              {HOURS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00 UTC ({utcToLocal(h)} local)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Publish to</label>
            <div className="space-y-2">
              {ytChannels.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selYt} onChange={(e) => setSelYt(e.target.checked)} className="rounded bg-gray-800 border-gray-700 text-red-600" />
                  <span className="text-gray-300">YouTube</span>
                  {ytChannels.length > 1 && (
                    <select value={ytChannel} onChange={(e) => setYtChannel(e.target.value)} className="ml-auto bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white">
                      {ytChannels.map((ch) => <option key={ch.id} value={ch.id}>{ch.account_name}</option>)}
                    </select>
                  )}
                </label>
              )}
              {igChannels.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selIg} onChange={(e) => setSelIg(e.target.checked)} className="rounded bg-gray-800 border-gray-700 text-pink-600" />
                  <span className="text-gray-300">Instagram</span>
                  {igChannels.length > 1 && (
                    <select value={igChannel} onChange={(e) => setIgChannel(e.target.value)} className="ml-auto bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white">
                      {igChannels.map((ch) => <option key={ch.id} value={ch.id}>{ch.account_name}</option>)}
                    </select>
                  )}
                </label>
              )}
              {ytChannels.length === 0 && igChannels.length === 0 && (
                <p className="text-xs text-gray-500">No channels connected. <Link href="/dashboard/settings" className="text-indigo-400 hover:underline">Connect channels</Link></p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancel</button>
            <button onClick={handleCreate} disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              {submitting ? "Creating..." : "Create Automation"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && items.length === 0 && !creating && (
        <div className="text-center py-16 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-lg">
          <p className="text-base mb-2">No automations yet</p>
          <p className="text-sm text-gray-600">Create one to auto-generate and post videos daily</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="bg-gray-900/50 border border-gray-800 rounded-lg px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                  <img src={`/styles/${a.style}.webp`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.name}</p>
                  <p className="text-xs text-gray-500">
                    {STYLES_MAP[a.style] || a.style} · {a.topics.length} topics · Posts at {String(a.post_hour).padStart(2, "0")}:00 UTC
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                {/* Next run */}
                {a.next_run_at && (
                  <span className="text-xs text-gray-500 hidden sm:block">
                    Next: {new Date(a.next_run_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}

                {/* Run count */}
                <span className="text-xs text-gray-600">{a.total_runs} runs</span>

                {/* Status */}
                {a.latest_run && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    a.latest_run.status === "published" ? "bg-green-900/50 text-green-400" :
                    a.latest_run.status === "failed" ? "bg-red-900/50 text-red-400" :
                    a.latest_run.status === "generating" ? "bg-yellow-900/50 text-yellow-400" :
                    "bg-gray-800 text-gray-400"
                  }`}>{a.latest_run.status}</span>
                )}

                {/* Active toggle */}
                <button onClick={() => handleToggle(a.id, a.is_active)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${a.is_active ? "bg-indigo-600" : "bg-gray-700"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${a.is_active ? "left-[18px]" : "left-0.5"}`} />
                </button>

                {/* Delete */}
                <button onClick={() => handleDelete(a.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
