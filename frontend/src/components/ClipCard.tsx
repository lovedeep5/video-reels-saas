"use client";
import { useState, useEffect } from "react";
import { Clip, jobsApi, YouTubeStatus, InstagramStatus, ChannelInfo, youtubeApi, instagramApi, authApi, isPaidPlan, AuthUser } from "@/lib/api";

interface Props {
  clip: Clip;
  jobId: string;
  videoTitle?: string | null;
  onPublished?: (clipIndex: number, url: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

// ── YouTube publish modal ─────────────────────────────────────────────────────

interface PublishModalProps {
  clip: Clip;
  jobId: string;
  videoTitle: string | null;
  channels: ChannelInfo[];
  onClose: (publishedUrl?: string) => void;
}

function YouTubePublishModal({ clip, jobId, videoTitle, channels, onClose }: PublishModalProps) {
  const [title, setTitle] = useState(clip.yt_title ?? "");
  const [description, setDescription] = useState(clip.yt_description ?? "");
  const [tags, setTags] = useState((clip.yt_tags ?? []).join(", "));
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("public");
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState(channels[0]?.id ?? "");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url: string; scheduled?: string } | null>(null);
  const [error, setError] = useState("");

  const hasAiMeta = !!(clip.yt_title || clip.yt_description || clip.yt_tags?.length);
  const minSchedule = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16);

  async function handlePublish() {
    if (!title.trim()) { setError("Title is required."); return; }
    if (publishMode === "schedule" && !scheduledAt) { setError("Please select a date and time to schedule."); return; }
    setPublishing(true);
    setError("");
    try {
      const res = await youtubeApi.publish(jobId, clip.clip_index, {
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        visibility,
        ...(publishMode === "schedule" ? { publishAt: new Date(scheduledAt).toISOString() } : {}),
        ...(selectedChannelId ? { channel_id: selectedChannelId } : {}),
      });
      setResult({ url: res.data.youtube_url, scheduled: publishMode === "schedule" ? scheduledAt : undefined });
    } catch (e: unknown) {
      setError((e as any)?.response?.data?.error || (e as Error).message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="currentColor">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
            </svg>
            <span className="text-white font-semibold">Publish to YouTube</span>
          </div>
          <button onClick={() => onClose(result?.url)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">{result.scheduled ? "🗓️" : "🎉"}</div>
            {result.scheduled ? (
              <>
                <p className="text-white font-medium mb-1">Scheduled successfully!</p>
                <p className="text-sm text-gray-400 mb-2">Will go public on {new Date(result.scheduled).toLocaleString()}</p>
              </>
            ) : (
              <p className="text-white font-medium mb-1">Published successfully!</p>
            )}
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 underline break-all">{result.url}</a>
            <button onClick={() => onClose(result.url)} className="mt-5 block w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg">Close</button>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            {hasAiMeta && (
              <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-950/40 border border-indigo-900 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                AI-generated during processing — edit freely before publishing
              </div>
            )}
            {channels.length > 1 && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Channel</label>
                <select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500">
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.account_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title <span className="text-red-400">*</span><span className="float-right">{title.length}/100</span></label>
              <input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter video title..." className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description<span className="float-right">{description.length}/5000</span></label>
              <textarea maxLength={5000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter video description..." className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated, max 15)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="shorts, viral, trending..." className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">When to publish</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPublishMode("now")} className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${publishMode === "now" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}>Publish now</button>
                <button type="button" onClick={() => setPublishMode("schedule")} className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${publishMode === "schedule" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}>Schedule for later</button>
              </div>
            </div>
            {publishMode === "schedule" ? (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Publish date &amp; time</label>
                <input type="datetime-local" value={scheduledAt} min={minSchedule} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 [color-scheme:dark]"/>
                <p className="text-xs text-gray-500 mt-1">Video stays Private until this time, then YouTube auto-publishes it.</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Visibility</label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500">
                  <option value="private">Private (only you)</option>
                  <option value="unlisted">Unlisted (anyone with link)</option>
                  <option value="public">Public</option>
                </select>
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={handlePublish} disabled={publishing || !title.trim() || (publishMode === "schedule" && !scheduledAt)} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {publishing ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>{publishMode === "schedule" ? "Scheduling..." : "Publishing... (may take a minute)"}</>
              ) : (publishMode === "schedule" ? "Schedule on YouTube" : "Publish to YouTube")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Instagram publish modal ──────────────────────────────────────────────────

interface IgPublishModalProps {
  clip: Clip;
  jobId: string;
  videoTitle: string | null;
  channels: ChannelInfo[];
  onClose: (publishedUrl?: string) => void;
}

function InstagramPublishModal({ clip, jobId, videoTitle, channels, onClose }: IgPublishModalProps) {
  const [selectedChannelId, setSelectedChannelId] = useState(channels[0]?.id ?? "");
  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? channels[0];
  const igUsername = selectedChannel?.account_name ?? "";
  const [caption, setCaption] = useState(
    clip.yt_description
      ? `${clip.yt_title ?? videoTitle ?? ""}\n\n${clip.yt_description}`.trim()
      : (videoTitle ?? "")
  );
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");

  async function handlePublish() {
    setPublishing(true);
    setError("");
    try {
      const res = await instagramApi.publish(jobId, clip.clip_index, { caption: caption.trim(), channel_id: selectedChannelId });
      setResult({ url: res.data.instagram_url });
    } catch (e: unknown) {
      setError((e as any)?.response?.data?.error || (e as Error).message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="url(#ig-gradient-modal)">
              <defs>
                <linearGradient id="ig-gradient-modal" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f9ce34"/>
                  <stop offset="33%" stopColor="#ee2a7b"/>
                  <stop offset="100%" stopColor="#6228d7"/>
                </linearGradient>
              </defs>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span className="text-white font-semibold">Publish to Instagram</span>
          </div>
          <button onClick={() => onClose(result?.url)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-white font-medium mb-1">Published as Reel!</p>
            <p className="text-sm text-gray-400 mb-2">Posted to @{igUsername}</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 underline break-all">{result.url}</a>
            <button onClick={() => onClose(result.url)} className="mt-5 block w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg">Close</button>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            {channels.length > 1 ? (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Account</label>
                <select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500">
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>@{ch.account_name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                Publishing as Reel to @{igUsername}
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Caption<span className="float-right">{caption.length}/2200</span></label>
              <textarea maxLength={2200} rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"/>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={handlePublish} disabled={publishing} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {publishing ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Publishing as Reel... (may take a minute)</>
              ) : "Publish as Instagram Reel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ClipCard ─────────────────────────────────────────────────────────────

export default function ClipCard({ clip, jobId, videoTitle, onPublished }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [showYtPublish, setShowYtPublish] = useState(false);
  const [showIgPublish, setShowIgPublish] = useState(false);
  const [ytStatus, setYtStatus] = useState<YouTubeStatus | null>(null);
  const [igStatus, setIgStatus] = useState<InstagramStatus | null>(null);
  const [ytPublishedUrl, setYtPublishedUrl] = useState<string | null>(clip.youtube_url ?? null);
  const [igPublishedUrl, setIgPublishedUrl] = useState<string | null>(clip.instagram_url ?? null);
  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  useEffect(() => {
    youtubeApi.status().then((r) => setYtStatus(r.data)).catch(() => {});
    instagramApi.status().then((r) => setIgStatus(r.data)).catch(() => {});
    authApi.me().then((r: { data: AuthUser }) => {
      setIsPaid(isPaidPlan(r.data.plan));
      setIsAdmin(r.data.is_admin ?? false);
    }).catch(() => {});
  }, []);

  async function getPresignedUrl(): Promise<string> {
    const apiUrl = jobsApi.downloadUrl(jobId, clip.id);
    const res = await fetch(apiUrl, { credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error ${res.status}`);
    }
    const { url } = await res.json();
    return url;
  }

  async function handlePlay() {
    if (playerUrl) { setPlayerUrl(null); return; }
    setLoadingPlayer(true);
    setDownloadError("");
    try {
      const url = await getPresignedUrl();
      setPlayerUrl(url);
    } catch (e: unknown) {
      setDownloadError((e as Error).message || "Failed to load video");
    } finally {
      setLoadingPlayer(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setDownloadError("");
    try {
      const url = playerUrl ?? await getPresignedUrl();
      const a = document.createElement("a");
      a.href = url;
      a.download = `reel_clip_${clip.clip_index + 1}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: unknown) {
      setDownloadError((e as Error).message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const canPublish = isPaid || isAdmin;

  return (
    <>
      {showYtPublish && (
        <YouTubePublishModal
          clip={clip}
          jobId={jobId}
          videoTitle={videoTitle ?? null}
          channels={ytStatus?.channels ?? []}
          onClose={(url) => {
            setShowYtPublish(false);
            if (url) { setYtPublishedUrl(url); onPublished?.(clip.clip_index, url); }
          }}
        />
      )}
      {showIgPublish && igStatus?.connected && (
        <InstagramPublishModal
          clip={clip}
          jobId={jobId}
          videoTitle={videoTitle ?? null}
          channels={igStatus?.channels ?? []}
          onClose={(url) => {
            setShowIgPublish(false);
            if (url) { setIgPublishedUrl(url); onPublished?.(clip.clip_index, url); }
          }}
        />
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
        {/* Video player area */}
        {clip.file_ready && (
          <div className="relative bg-black w-full h-52 overflow-hidden">
            {playerUrl ? (
              <video src={playerUrl} controls autoPlay className="w-full h-full object-contain" onError={() => { setPlayerUrl(null); setDownloadError("Video failed to load."); }}/>
            ) : (
              <button onClick={handlePlay} disabled={loadingPlayer} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors group">
                {loadingPlayer ? (
                  <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                )}
                <span className="text-xs">{loadingPlayer ? "Loading..." : "Preview"}</span>
              </button>
            )}
          </div>
        )}

        <div className="p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm font-semibold text-white">Clip {clip.clip_index + 1}</span>
              <span className="ml-2 text-xs text-gray-500">
                {formatTime(clip.start_time)} — {formatTime(clip.end_time)} ({formatDuration(clip.duration)})
              </span>
            </div>
            <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">
              {Math.round(clip.importance_score * 100)}% relevance
            </span>
          </div>

          {/* Transcript excerpt */}
          {clip.transcript_excerpt && (
            <p className="text-sm text-gray-400 italic line-clamp-2">&quot;{clip.transcript_excerpt}&quot;</p>
          )}

          {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}

          {/* Published badges */}
          {ytPublishedUrl && (
            <a href={ytPublishedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-950/50 border border-red-900 rounded-lg px-3 py-1.5 w-fit">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
              Published on YouTube ↗
            </a>
          )}
          {igPublishedUrl && (
            <a href={igPublishedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 bg-pink-950/50 border border-pink-900 rounded-lg px-3 py-1.5 w-fit">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              Published on Instagram ↗
            </a>
          )}

          {/* Action buttons */}
          {clip.file_ready ? (
            <div className="mt-auto flex flex-wrap gap-2">
              {/* Download */}
              <button onClick={handleDownload} disabled={downloading} className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg">
                {downloading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Downloading...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download</>
                )}
              </button>

              {/* YouTube publish */}
              {canPublish && ytStatus?.connected ? (
                <button onClick={() => setShowYtPublish(true)} title={ytPublishedUrl ? "Republish to YouTube" : "Publish to YouTube"} className="inline-flex items-center justify-center gap-1.5 bg-red-700 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                  {ytPublishedUrl ? "Republish" : "YouTube"}
                </button>
              ) : canPublish && !ytStatus?.connected ? (
                <a href="/dashboard/settings" className="inline-flex items-center justify-center gap-1.5 border border-red-900 text-red-400 hover:text-red-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors">Connect YouTube</a>
              ) : null}

              {/* Instagram publish */}
              {canPublish && igStatus?.connected ? (
                <button onClick={() => setShowIgPublish(true)} title={igPublishedUrl ? "Republish to Instagram" : "Publish to Instagram"} className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  {igPublishedUrl ? "Republish" : "Instagram"}
                </button>
              ) : canPublish && !igStatus?.connected ? (
                <a href="/dashboard/settings" className="inline-flex items-center justify-center gap-1.5 border border-pink-900 text-pink-400 hover:text-pink-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors">Connect Instagram</a>
              ) : null}

              {/* Upgrade prompt for free users */}
              {!canPublish && (
                <a href="/billing" title="Upgrade to publish" className="inline-flex items-center justify-center gap-1.5 border border-indigo-800 text-indigo-400 hover:text-indigo-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors">↑ Upgrade to Publish</a>
              )}
            </div>
          ) : (
            <div className="mt-auto text-sm text-gray-500 italic">Rendering...</div>
          )}
        </div>
      </div>
    </>
  );
}
