"use client";
import { useState } from "react";
import { Clip, jobsApi } from "@/lib/api";
interface Props {
  clip: Clip;
  jobId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

export default function ClipCard({ clip, jobId }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      const url = jobsApi.downloadUrl(jobId, clip.id);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `reel_clip_${clip.clip_index + 1}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: unknown) {
      setError((e as Error).message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
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
        <p className="text-sm text-gray-400 italic line-clamp-2">
          &quot;{clip.transcript_excerpt}&quot;
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Download button */}
      {clip.file_ready ? (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="mt-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg"
        >
          {downloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Downloading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Reel
            </>
          )}
        </button>
      ) : (
        <div className="mt-auto text-sm text-gray-500 italic">Rendering...</div>
      )}
    </div>
  );
}
