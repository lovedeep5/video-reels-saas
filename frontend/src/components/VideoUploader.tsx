"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { videoApi, cookiesApi } from "@/lib/api";

const RATIO_PRESETS = [
  {
    key: "9:16",
    label: "9:16",
    desc: "Reels / Shorts / TikTok",
    platforms: "Instagram · YouTube · TikTok",
    visual: "h-14 w-8",
  },
  {
    key: "1:1",
    label: "1:1",
    desc: "Square",
    platforms: "Instagram · Facebook",
    visual: "h-10 w-10",
  },
  {
    key: "4:5",
    label: "4:5",
    desc: "Portrait Feed",
    platforms: "Instagram Feed",
    visual: "h-12 w-10",
  },
  {
    key: "16:9",
    label: "16:9",
    desc: "Landscape",
    platforms: "YouTube · Twitter/X",
    visual: "h-8 w-14",
  },
  {
    key: "4:3",
    label: "4:3",
    desc: "Classic",
    platforms: "Facebook · General",
    visual: "h-9 w-12",
  },
  {
    key: "custom",
    label: "Custom",
    desc: "Enter ratio",
    platforms: "",
    visual: null,
  },
] as const;

// ── Cookie sync confirmation modal ───────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

function CookieSyncModal({
  synced,
  needsRefresh,
  lastModified,
  onConfirm,
  onCancel,
}: {
  synced: boolean;
  needsRefresh: boolean;
  lastModified: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // "Ready" = synced and NOT used by a subsequent job
  const isReady = synced && !needsRefresh;

  const syncInstructions = (
    <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
      {[
        "Install the VidToReels Chrome extension",
        "Make sure you're logged into YouTube",
        <>Click the extension → <strong>Sync My YouTube Cookies</strong></>,
        "Come back and submit your video",
      ].map((step, i) => (
        <div key={i} className="flex items-start gap-2 text-gray-300">
          <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col gap-5">

        {isReady ? (
          /* ── Cookies fresh and ready ── */
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-green-400 text-xl flex-shrink-0">✓</div>
              <div>
                <p className="text-white font-semibold">Cookies synced and ready</p>
                {lastModified && <p className="text-xs text-gray-400">Synced {timeAgo(lastModified)}</p>}
              </div>
            </div>
            <p className="text-sm text-gray-300">Your YouTube cookies are fresh. Click <strong>Process Video</strong> to continue.</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Process Video</button>
            </div>
          </>
        ) : needsRefresh ? (
          /* ── Cookies exist but were used by a previous job ── */
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-900 flex items-center justify-center text-orange-400 text-xl flex-shrink-0">↻</div>
              <div>
                <p className="text-white font-semibold">Cookies need re-sync</p>
                {lastModified && <p className="text-xs text-gray-400">Last synced {timeAgo(lastModified)} — used by a previous video</p>}
              </div>
            </div>
            <p className="text-sm text-gray-300">
              YouTube cookies are single-use from our servers. Your last video used them up.
              Please sync again before processing a new video.
            </p>
            {syncInstructions}
            <div className="flex gap-3 flex-wrap">
              <a href="/dashboard/settings" target="_blank" className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center">
                Open Extension / Settings
              </a>
              <button onClick={onConfirm} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-sm">
                Proceed anyway
              </button>
            </div>
            <button onClick={onCancel} className="text-xs text-gray-600 hover:text-gray-400 text-center">Cancel</button>
          </>
        ) : (
          /* ── Never synced ── */
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-900 flex items-center justify-center text-yellow-400 text-xl flex-shrink-0">!</div>
              <div>
                <p className="text-white font-semibold">Sync your YouTube cookies first</p>
                <p className="text-xs text-gray-400">Required to download YouTube videos from our servers</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              Our servers need your YouTube session to bypass bot detection.
              Takes 5 seconds with the Chrome extension.
            </p>
            {syncInstructions}
            <div className="flex gap-3 flex-wrap">
              <a href="/dashboard/settings" target="_blank" className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold text-center">
                Get the Extension
              </a>
              <button onClick={onConfirm} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-sm">
                Proceed anyway
              </button>
            </div>
            <button onClick={onCancel} className="text-xs text-gray-600 hover:text-gray-400 text-center">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main uploader ─────────────────────────────────────────────────────────────

export default function VideoUploader() {
  const router = useRouter();
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [clips, setClips] = useState(5);
  const [ratio, setRatio] = useState("9:16");
  const [customRatio, setCustomRatio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Cookie sync state
  const [cookieSynced, setCookieSynced] = useState<boolean | null>(null);
  const [cookieLastModified, setCookieLastModified] = useState<string | null>(null);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const pendingSubmitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cookiesApi.status()
      .then((r) => {
        setCookieSynced(r.data.synced);
        setCookieLastModified(r.data.last_modified ?? null);
      })
      .catch(() => setCookieSynced(false));
  }, []);

  const selectedPreset = ratio === "custom" ? "custom" : ratio;

  function getEffectiveRatio() {
    if (ratio === "custom") {
      const trimmed = customRatio.trim();
      return trimmed || "9:16";
    }
    return ratio;
  }

  const isYouTubeUrl = (u: string) =>
    /youtube\.com|youtu\.be/i.test(u);

  async function doSubmit() {
    setLoading(true);
    const effectiveRatio = getEffectiveRatio();
    try {
      let res;
      if (tab === "url") {
        res = await videoApi.submitUrl(url.trim(), clips, effectiveRatio);
      } else {
        res = await videoApi.upload(file!, clips, effectiveRatio);
      }
      router.push(`/dashboard/jobs/${res.data.job_id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Submission failed");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (ratio === "custom" && customRatio.trim() && !/^\d+:\d+$/.test(customRatio.trim())) {
      setError("Custom ratio must be in format W:H (e.g. 3:4)");
      return;
    }

    if (tab === "url") {
      if (!url.trim()) { setError("Please enter a URL"); return; }
      // Show cookie modal for YouTube URLs
      if (isYouTubeUrl(url)) {
        pendingSubmitRef.current = doSubmit;
        setShowCookieModal(true);
        return;
      }
    } else {
      if (!file) { setError("Please select a file"); return; }
    }

    await doSubmit();
  }

  return (
    <>
    {showCookieModal && (
      <CookieSyncModal
        synced={cookieSynced ?? false}
        lastModified={cookieLastModified}
        onConfirm={() => {
          setShowCookieModal(false);
          pendingSubmitRef.current?.();
        }}
        onCancel={() => setShowCookieModal(false)}
      />
    )}
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6 max-w-2xl">
      {/* Tabs */}
      <div className="flex border border-gray-700 rounded-lg overflow-hidden w-fit">
        {(["url", "upload"] as const).map((t) => (
          <button
            key={t} type="button" onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium ${tab === t ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}
          >
            {t === "url" ? "YouTube / URL" : "Upload File"}
          </button>
        ))}
      </div>

      {/* Input */}
      {tab === "url" ? (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Video URL</label>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">YouTube, Vimeo, and most video platforms supported</p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Video File</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer"
          >
            {file ? (
              <p className="text-sm text-indigo-300 font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-gray-400 text-sm">Click to select or drag & drop</p>
                <p className="text-gray-600 text-xs mt-1">MP4, MOV, AVI, MKV, WebM</p>
              </>
            )}
          </div>
          <input
            ref={fileRef} type="file"
            accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {/* Output ratio */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Output Ratio</label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {RATIO_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setRatio(preset.key)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all text-center ${
                selectedPreset === preset.key
                  ? "border-indigo-500 bg-indigo-600/20 text-white"
                  : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500 hover:text-white"
              }`}
            >
              {preset.visual ? (
                <div className={`${preset.visual} rounded-sm border-2 ${selectedPreset === preset.key ? "border-indigo-400" : "border-gray-500"}`} />
              ) : (
                <div className="h-8 w-8 flex items-center justify-center text-lg font-bold text-gray-400">?</div>
              )}
              <span className="text-xs font-semibold leading-none">{preset.label}</span>
              <span className="text-[10px] leading-none text-gray-500">{preset.desc}</span>
            </button>
          ))}
        </div>

        {/* Platform hint */}
        {selectedPreset !== "custom" && (
          <p className="text-xs text-gray-500 mt-2">
            {RATIO_PRESETS.find((p) => p.key === selectedPreset)?.platforms}
          </p>
        )}

        {/* Custom ratio input */}
        {selectedPreset === "custom" && (
          <div className="mt-3">
            <input
              type="text"
              value={customRatio}
              onChange={(e) => setCustomRatio(e.target.value)}
              placeholder="e.g. 3:4"
              className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Enter width:height (e.g. 3:4, 2:3)</p>
          </div>
        )}
      </div>

      {/* Clips count */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Number of clips: <span className="text-indigo-400">{clips}</span>
        </label>
        <input
          type="range" min={1} max={10} value={clips}
          onChange={(e) => setClips(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1</span><span>10</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
      >
        {loading ? "Submitting..." : "Generate Reels"}
      </button>
    </form>
    </>
  );
}
