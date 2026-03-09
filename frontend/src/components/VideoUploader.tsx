"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { videoApi } from "@/lib/api";

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

  const selectedPreset = ratio === "custom" ? "custom" : ratio;

  function getEffectiveRatio() {
    if (ratio === "custom") {
      const trimmed = customRatio.trim();
      return trimmed || "9:16";
    }
    return ratio;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (ratio === "custom" && customRatio.trim() && !/^\d+:\d+$/.test(customRatio.trim())) {
      setError("Custom ratio must be in format W:H (e.g. 3:4)");
      return;
    }

    setLoading(true);
    const effectiveRatio = getEffectiveRatio();

    try {
      let res;
      if (tab === "url") {
        if (!url.trim()) { setError("Please enter a URL"); setLoading(false); return; }
        res = await videoApi.submitUrl(url.trim(), clips, effectiveRatio);
      } else {
        if (!file) { setError("Please select a file"); setLoading(false); return; }
        res = await videoApi.upload(file, clips, effectiveRatio);
      }
      router.push(`/dashboard/jobs/${res.data.job_id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}
