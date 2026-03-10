"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { youtubeApi, authApi, YouTubeStatus, AuthUser } from "@/lib/api";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const ytResult = searchParams.get("youtube");
    if (ytResult === "connected") showToast("YouTube connected successfully!", true);
    else if (ytResult === "denied") showToast("YouTube connection was cancelled.", false);
    else if (ytResult === "error") showToast("YouTube connection failed. Please try again.", false);
    else if (ytResult === "upgrade_required") showToast("YouTube publishing is available on Pro and Business plans.", false);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      youtubeApi.status().then((r) => setStatus(r.data)).catch(() => setStatus({ connected: false, configured: false })),
      authApi.me().then((r) => setUser(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your YouTube channel?")) return;
    setDisconnecting(true);
    try {
      await youtubeApi.disconnect();
      setStatus((s) => s ? { ...s, connected: false, channel: null } : s);
      showToast("YouTube disconnected.", true);
    } catch {
      showToast("Failed to disconnect. Try again.", false);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.ok ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* YouTube Integration Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          {/* YouTube logo */}
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-red-500 flex-shrink-0" fill="currentColor">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-white">YouTube</h2>
            <p className="text-sm text-gray-400">Publish clips directly to your YouTube channel</p>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : !status?.configured ? (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4 text-sm text-yellow-300">
            YouTube integration is not configured. Add <code className="font-mono">YOUTUBE_CLIENT_ID</code> and{" "}
            <code className="font-mono">YOUTUBE_CLIENT_SECRET</code> to your environment variables.
          </div>
        ) : user && user.plan === "free" ? (
          <div className="space-y-3">
            <div className="bg-indigo-950/50 border border-indigo-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-white mb-1">Pro & Business feature</p>
              <p className="text-sm text-gray-400">
                Direct YouTube publishing is available on paid plans. Free users can download clips and upload manually.
              </p>
            </div>
            <a
              href="/billing"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        ) : status.connected && status.channel ? (
          <div>
            <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800 rounded-lg mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{status.channel.channel_title}</p>
                <p className="text-xs text-gray-400">Connected channel</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect YouTube"}
            </button>
          </div>
        ) : (
          <a
            href="/api/youtube/connect"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
            </svg>
            Connect YouTube Channel
          </a>
        )}
      </div>
    </div>
  );
}
