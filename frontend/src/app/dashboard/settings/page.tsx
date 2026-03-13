"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { youtubeApi, instagramApi, authApi, YouTubeStatus, InstagramStatus, AuthUser, ChannelInfo } from "@/lib/api";

const MAX_CHANNELS = 5;

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [ytStatus, setYtStatus] = useState<YouTubeStatus | null>(null);
  const [igStatus, setIgStatus] = useState<InstagramStatus | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const ytResult = searchParams.get("youtube");
    if (ytResult === "connected") showToast("YouTube connected successfully!", true);
    else if (ytResult === "denied") showToast("YouTube connection was cancelled.", false);
    else if (ytResult === "error") showToast("YouTube connection failed. Please try again.", false);
    else if (ytResult === "upgrade_required") showToast("Publishing is available on Pro and Business plans.", false);
    else if (ytResult === "limit") showToast(`Maximum ${MAX_CHANNELS} channels reached. Disconnect one first.`, false);

    const igResult = searchParams.get("instagram");
    if (igResult === "connected") showToast("Instagram connected successfully!", true);
    else if (igResult === "denied") showToast("Instagram connection was cancelled.", false);
    else if (igResult === "error") showToast("Instagram connection failed. Please try again.", false);
    else if (igResult === "upgrade_required") showToast("Publishing is available on Pro and Business plans.", false);
    else if (igResult === "limit") showToast(`Maximum ${MAX_CHANNELS} channels reached. Disconnect one first.`, false);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      youtubeApi.status().then((r) => setYtStatus(r.data)).catch(() => setYtStatus({ connected: false, configured: false, channels: [] })),
      instagramApi.status().then((r) => setIgStatus(r.data)).catch(() => setIgStatus({ configured: false, connected: false, channels: [], account: null })),
      authApi.me().then((r) => setUser(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  const totalChannels = (ytStatus?.channels?.length ?? 0) + (igStatus?.channels?.length ?? 0);
  const canAddMore = totalChannels < MAX_CHANNELS;

  async function handleDisconnect(platform: "youtube" | "instagram", channel: ChannelInfo) {
    if (!confirm(`Disconnect ${channel.account_name}?`)) return;
    setDisconnecting(channel.id);
    try {
      if (platform === "youtube") {
        await youtubeApi.disconnect(channel.id);
        setYtStatus((s) => s ? { ...s, channels: s.channels.filter((c) => c.id !== channel.id), connected: s.channels.length > 1 } : s);
      } else {
        await instagramApi.disconnect(channel.id);
        setIgStatus((s) => s ? { ...s, channels: s.channels.filter((c) => c.id !== channel.id), connected: s.channels.length > 1 } : s);
      }
      showToast(`${channel.account_name} disconnected.`, true);
    } catch {
      showToast("Failed to disconnect. Try again.", false);
    } finally {
      setDisconnecting(null);
    }
  }

  const isPaid = user && (user.plan === "pro" || user.plan === "business");
  const isAdmin = user?.is_admin;
  const canPublish = isPaid || isAdmin;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Connected Channels</h1>
        <span className="text-xs text-gray-500">{totalChannels}/{MAX_CHANNELS} channels</span>
      </div>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${toast.ok ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : !canPublish ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <div className="bg-indigo-950/50 border border-indigo-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-white mb-1">Pro & Business feature</p>
            <p className="text-sm text-gray-400">
              Publishing to YouTube and Instagram is available on paid plans. Free users can download clips and upload manually.
            </p>
          </div>
          <a href="/billing" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
            Upgrade to Pro
          </a>
        </div>
      ) : (
        <>
          {/* Instagram Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="url(#ig-grad-s)">
                <defs><linearGradient id="ig-grad-s" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f9ce34"/><stop offset="33%" stopColor="#ee2a7b"/><stop offset="100%" stopColor="#6228d7"/></linearGradient></defs>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <h2 className="text-lg font-semibold text-white">Instagram</h2>
            </div>

            {!igStatus?.configured ? (
              <p className="text-sm text-yellow-300">Instagram integration is not configured.</p>
            ) : (
              <div className="space-y-3">
                {(igStatus.channels ?? []).map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">@{ch.account_name}</p>
                      <p className="text-xs text-gray-500">Connected {new Date(ch.connected_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleDisconnect("instagram", ch)}
                      disabled={disconnecting === ch.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1"
                    >
                      {disconnecting === ch.id ? "..." : "Disconnect"}
                    </button>
                  </div>
                ))}
                {canAddMore && (
                  <a href="/api/instagram/connect" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                    + Connect Instagram Account
                  </a>
                )}
              </div>
            )}
          </div>

          {/* YouTube Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500 flex-shrink-0" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
              </svg>
              <h2 className="text-lg font-semibold text-white">YouTube</h2>
            </div>

            {!ytStatus?.configured ? (
              <p className="text-sm text-yellow-300">YouTube integration is not configured.</p>
            ) : (
              <div className="space-y-3">
                {(ytStatus.channels ?? []).map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ch.account_name}</p>
                      <p className="text-xs text-gray-500">Connected {new Date(ch.connected_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleDisconnect("youtube", ch)}
                      disabled={disconnecting === ch.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1"
                    >
                      {disconnecting === ch.id ? "..." : "Disconnect"}
                    </button>
                  </div>
                ))}
                {canAddMore && (
                  <a href="/api/youtube/connect" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                    + Connect YouTube Channel
                  </a>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
