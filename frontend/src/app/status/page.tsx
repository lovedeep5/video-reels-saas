"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

interface Check {
  ok: boolean;
  detail: string;
  dirs?: Record<string, string>;
}

interface HealthResponse {
  status: "ok" | "degraded";
  checks: Record<string, Check>;
}

const CHECK_LABELS: Record<string, string> = {
  backend:  "Backend API",
  database: "Database",
  ffmpeg:   "FFmpeg",
  ffprobe:  "FFprobe",
  s3:       "AWS S3",
  yt_dlp:   "yt-dlp",
  whisper:  "Whisper (AI)",
  opencv:   "OpenCV",
  storage:  "Storage / Disk",
};

const CHECK_ORDER = ["backend", "database", "ffmpeg", "ffprobe", "s3", "yt_dlp", "whisper", "opencv", "storage"];

export default function StatusPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [frontendOk] = useState(true); // if this page loads, frontend is up
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<HealthResponse>("/health");
      setData(res.data);
      setLastChecked(new Date());
    } catch {
      setError("Could not reach backend — is it running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const allOk = frontendOk && data?.status === "ok";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">System Status</h1>
            {lastChecked && (
              <p className="text-xs text-gray-500 mt-1">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm font-medium border border-gray-700"
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
        </div>

        {/* Overall badge */}
        <div className={`rounded-xl border p-5 flex items-center gap-4 ${
          error
            ? "border-red-700 bg-red-900/20"
            : allOk
            ? "border-green-700 bg-green-900/20"
            : "border-yellow-700 bg-yellow-900/20"
        }`}>
          <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
            error ? "bg-red-500" : allOk ? "bg-green-500 animate-pulse" : "bg-yellow-500"
          }`} />
          <div>
            <p className="font-semibold text-lg">
              {error ? "Backend unreachable" : allOk ? "All systems operational" : "Some checks failing"}
            </p>
            {error && <p className="text-sm text-red-400 mt-0.5">{error}</p>}
          </div>
        </div>

        {/* Frontend row — always shown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Services</span>
          </div>

          {/* Frontend */}
          <CheckRow label="Frontend (Next.js)" ok detail="running" />

          {/* Backend checks */}
          {data && CHECK_ORDER.map((key) => {
            const check = data.checks[key];
            if (!check) return null;
            return (
              <CheckRow
                key={key}
                label={CHECK_LABELS[key] ?? key}
                ok={check.ok}
                detail={check.detail}
                extra={
                  key === "storage" && check.dirs
                    ? Object.entries(check.dirs).map(([d, s]) => `${d}: ${s}`).join(" · ")
                    : undefined
                }
              />
            );
          })}

          {!data && !loading && (
            <div className="px-5 py-4 text-sm text-gray-500 italic">Backend checks unavailable</div>
          )}
          {loading && (
            <div className="px-5 py-4 text-sm text-gray-500">Checking...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckRow({
  label,
  ok,
  detail,
  extra,
}: {
  label: string;
  ok: boolean;
  detail: string;
  extra?: string;
}) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-gray-800/60 last:border-b-0">
      <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-white">{label}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            ok ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
          }`}>
            {ok ? "OK" : "FAIL"}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>
        {extra && <p className="text-xs text-gray-600 mt-0.5">{extra}</p>}
      </div>
    </div>
  );
}
