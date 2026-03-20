"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { scheduleApi, ScheduledPublish, automationsApi, Automation } from "@/lib/api";

function statusBadge(status: string) {
  switch (status) {
    case "scheduled": return "bg-indigo-900/60 text-indigo-300";
    case "pending": return "bg-indigo-900/60 text-indigo-300";
    case "publishing": return "bg-yellow-900/60 text-yellow-300";
    case "generating": return "bg-yellow-900/60 text-yellow-300";
    case "published": return "bg-green-900/60 text-green-300";
    case "ready": return "bg-green-900/60 text-green-300";
    case "failed": return "bg-red-900/60 text-red-300";
    case "cancelled": return "bg-gray-700 text-gray-400";
    default: return "bg-gray-700 text-gray-400";
  }
}

function timeDisplay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) {
    const ago = Math.abs(diff) / 1000;
    if (ago < 60) return "just now";
    if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
    if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (diff < 3600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `in ${Math.floor(diff / 3600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STYLES_MAP: Record<string, string> = {
  "comic": "Comic", "creepy-comic": "Creepy Comic", "modern-cartoon": "Cartoon", "disney": "Disney",
  "ghibli": "Ghibli", "anime": "Anime", "painting": "Painting", "dark-fantasy": "Dark Fantasy",
  "lego": "Lego", "polaroid": "Polaroid", "realistic": "Realism", "fantastic": "Fantastic",
};

export default function SchedulePage() {
  const [tab, setTab] = useState<"publishes" | "automations">("publishes");
  const [items, setItems] = useState<ScheduledPublish[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    Promise.all([
      scheduleApi.list().then((r) => setItems(r.data)).catch(() => {}),
      automationsApi.list().then((r) => setAutomations(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  async function handleCancelPublish(id: string) {
    if (!confirm("Cancel this scheduled publish?")) return;
    await scheduleApi.cancel(id);
    fetchAll();
  }

  async function handleToggleAutomation(id: string, active: boolean) {
    await automationsApi.toggle(id, !active);
    fetchAll();
  }

  async function handleDeleteAutomation(id: string) {
    if (!confirm("Delete this automation? Pending runs will be cancelled.")) return;
    await automationsApi.delete(id);
    fetchAll();
  }

  const scheduledCount = items.filter((i) => i.status === "scheduled").length;
  const publishedCount = items.filter((i) => i.status === "published").length;
  const activeAutomations = automations.filter((a) => a.is_active).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Schedule & Automations</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage scheduled posts and daily automations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-indigo-400">{scheduledCount}</div>
          <div className="text-xs text-gray-500">Scheduled</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-green-400">{publishedCount}</div>
          <div className="text-xs text-gray-500">Published</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-purple-400">{activeAutomations}</div>
          <div className="text-xs text-gray-500">Active Automations</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("publishes")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === "publishes" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >Scheduled Posts {items.length > 0 && <span className="ml-1 text-xs opacity-70">({items.length})</span>}</button>
        <button onClick={() => setTab("automations")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === "automations" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >Automations {automations.length > 0 && <span className="ml-1 text-xs opacity-70">({automations.length})</span>}</button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* ── Scheduled Posts Tab ─────────────────────────────────── */}
      {!loading && tab === "publishes" && (
        <>
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-lg">
              <p className="text-sm mb-1">No scheduled posts yet</p>
              <p className="text-xs text-gray-600">
                Create a video and pick a schedule time, or set up a daily automation.
              </p>
              <Link href="/dashboard/faceless" className="inline-block mt-3 text-xs text-indigo-400 hover:underline">
                Create Video →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs ${
                        item.platform === "youtube" ? "bg-red-900/50 text-red-400" : "bg-pink-900/50 text-pink-400"
                      }`}>
                        {item.platform === "youtube" ? "YT" : "IG"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.title || `Clip ${item.clip_index + 1}`}</p>
                        <p className="text-xs text-gray-500">
                          {item.platform === "youtube" ? "YouTube" : "Instagram"} · {timeDisplay(item.scheduled_at)}
                          {item.published_url && (
                            <> · <a href={item.published_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">View</a></>
                          )}
                        </p>
                        {item.error_message && <p className="text-xs text-red-400 mt-0.5 truncate">{item.error_message}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(item.status)}`}>{item.status}</span>
                      {item.status === "scheduled" && (
                        <button onClick={() => handleCancelPublish(item.id)} className="text-xs text-gray-500 hover:text-red-400">Cancel</button>
                      )}
                      <Link href={`/dashboard/jobs/${item.job_id}`} className="text-xs text-gray-600 hover:text-white">View</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Automations Tab ─────────────────────────────────────── */}
      {!loading && tab === "automations" && (
        <>
          {automations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-lg">
              <p className="text-sm mb-1">No automations yet</p>
              <p className="text-xs text-gray-600">
                Set up a daily automation from the Create Video page → Schedule step → Daily.
              </p>
              <Link href="/dashboard/faceless" className="inline-block mt-3 text-xs text-indigo-400 hover:underline">
                Create Automation →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {automations.map((a) => (
                <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-md overflow-hidden shrink-0">
                        <img src={`/styles/${a.style}.webp`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.name}</p>
                        <p className="text-xs text-gray-500">
                          {STYLES_MAP[a.style] || a.style} · Daily at {String(a.post_hour).padStart(2, "0")}:00 UTC · {a.topics.length} topic{a.topics.length !== 1 ? "s" : ""} · {a.total_runs} runs
                        </p>
                        {a.next_run_at && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            Next: {new Date(a.next_run_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            {a.latest_run && <> · Last: <span className={a.latest_run.status === "published" ? "text-green-400" : a.latest_run.status === "failed" ? "text-red-400" : "text-yellow-400"}>{a.latest_run.status}</span></>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button onClick={() => handleToggleAutomation(a.id, a.is_active)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${a.is_active ? "bg-indigo-600" : "bg-gray-700"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${a.is_active ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                      <button onClick={() => handleDeleteAutomation(a.id)} className="text-xs text-gray-600 hover:text-red-400">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
