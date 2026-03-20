"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { scheduleApi, ScheduledPublish } from "@/lib/api";

function statusBadge(status: string) {
  switch (status) {
    case "scheduled": return "bg-indigo-900/60 text-indigo-300";
    case "publishing": return "bg-yellow-900/60 text-yellow-300";
    case "published": return "bg-green-900/60 text-green-300";
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
    // In the past
    const ago = Math.abs(diff) / 1000;
    if (ago < 60) return "just now";
    if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
    if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  // In the future
  if (diff < 3600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `in ${Math.floor(diff / 3600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SchedulePage() {
  const [items, setItems] = useState<ScheduledPublish[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchItems = () => {
    const params = filter !== "all" ? { status: filter } : undefined;
    scheduleApi.list(params).then((r) => {
      setItems(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 30_000);
    return () => clearInterval(interval);
  }, [filter]); // eslint-disable-line

  async function handleCancel(id: string) {
    if (!confirm("Cancel this scheduled publish?")) return;
    await scheduleApi.cancel(id);
    fetchItems();
  }

  const scheduled = items.filter((i) => i.status === "scheduled").length;
  const published = items.filter((i) => i.status === "published").length;
  const failed = items.filter((i) => i.status === "failed").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage your scheduled and auto-posted videos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <div className="text-2xl font-bold text-indigo-400">{scheduled}</div>
          <div className="text-xs text-gray-500">Scheduled</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <div className="text-2xl font-bold text-green-400">{published}</div>
          <div className="text-xs text-gray-500">Published</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <div className="text-2xl font-bold text-red-400">{failed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {["all", "scheduled", "published", "failed", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading...</div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-xl">
          <p className="text-base mb-2">No scheduled posts yet</p>
          <p className="text-sm text-gray-600">
            Create a video and schedule it to publish from the job detail page.
          </p>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Platform icon */}
                <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs ${
                  item.platform === "youtube"
                    ? "bg-red-900/50 text-red-400"
                    : "bg-pink-900/50 text-pink-400"
                }`}>
                  {item.platform === "youtube" ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  )}
                </span>

                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {item.title || `Clip ${item.clip_index + 1}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.platform === "youtube" ? "YouTube" : "Instagram"}
                    {" \u00B7 "}
                    {timeDisplay(item.scheduled_at)}
                    {item.published_url && (
                      <>
                        {" \u00B7 "}
                        <a
                          href={item.published_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:underline"
                        >
                          View post
                        </a>
                      </>
                    )}
                  </p>
                  {item.error_message && (
                    <p className="text-xs text-red-400 mt-1 truncate">{item.error_message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusBadge(item.status)}`}>
                  {item.status}
                </span>
                {item.status === "scheduled" && (
                  <button
                    onClick={() => handleCancel(item.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <Link
                  href={`/dashboard/jobs/${item.job_id}`}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  View job
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
