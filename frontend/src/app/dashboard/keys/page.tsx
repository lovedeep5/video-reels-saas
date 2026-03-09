"use client";
import { useEffect, useState } from "react";
import { keysApi, ApiKey, ApiKeyCreated, ExpiryOption } from "@/lib/api";

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: "week",     label: "1 week" },
  { value: "month",    label: "1 month" },
  { value: "3months",  label: "3 months" },
  { value: "year",     label: "1 year" },
  { value: "custom",   label: "Custom date" },
  { value: "never",    label: "Never expires" },
];

function formatExpiry(expires_at: string | null, is_expired: boolean): string {
  if (!expires_at) return "Never expires";
  if (is_expired) return "Expired";
  const diff = Math.ceil((new Date(expires_at).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "Expires today";
  if (diff === 1) return "Expires tomorrow";
  if (diff < 30) return `Expires in ${diff} days`;
  if (diff < 365) return `Expires in ${Math.round(diff / 30)} months`;
  return `Expires ${new Date(expires_at).toLocaleDateString()}`;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newName, setNewName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("never");
  const [customDate, setCustomDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { keysApi.list().then(r => setKeys(r.data)); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (expiry === "custom" && !customDate) { setError("Please select a custom expiry date"); return; }
    setError(""); setCreating(true);
    try {
      const res = await keysApi.create(newName.trim(), expiry, expiry === "custom" ? customDate : undefined);
      setRevealed(res.data);
      setNewName("");
      setExpiry("never");
      setCustomDate("");
      keysApi.list().then(r => setKeys(r.data));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create key");
    } finally { setCreating(false); }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await keysApi.revoke(id);
    setKeys(k => k.filter(x => x.id !== id));
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-gray-400 text-sm mt-1">
          Use API keys to process videos programmatically without the UI.
        </p>
      </div>

      {/* Revealed key — shown once */}
      {revealed && (
        <div className="mb-6 bg-green-950 border border-green-700 rounded-xl p-5">
          <p className="text-green-300 font-semibold text-sm mb-1">
            API key created — copy it now. It won&apos;t be shown again.
          </p>
          <p className="text-xs text-gray-400">
            {formatExpiry(revealed.expires_at, false)}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <code className="flex-1 bg-gray-950 text-green-300 text-xs px-3 py-2 rounded-lg break-all font-mono">
              {revealed.full_key}
            </code>
            <button
              onClick={() => copyKey(revealed.full_key)}
              className="shrink-0 text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-lg"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setRevealed(null)} className="text-xs text-gray-500 mt-3 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-3">
        <p className="text-sm font-medium text-gray-200">Create new key</p>
        <input
          type="text" value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Key name (e.g. Production, n8n, My Script)"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-3 flex-wrap">
          <select
            value={expiry} onChange={e => setExpiry(e.target.value as ExpiryOption)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {EXPIRY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {expiry === "custom" && (
            <input
              type="date"
              value={customDate}
              min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
              onChange={e => setCustomDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          )}
          <button
            type="submit" disabled={creating || !newName.trim()}
            className="ml-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {creating ? "Creating..." : "Generate"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </form>

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-gray-500 text-sm">No API keys yet.</p>
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <div key={k.id} className={`bg-gray-900 border rounded-xl px-5 py-4 flex items-center gap-4 ${k.is_expired ? "border-red-900/50 opacity-60" : "border-gray-800"}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${k.is_expired ? "bg-red-500" : "bg-green-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{k.name}</p>
                  {k.is_expired && (
                    <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">Expired</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{k.key_prefix}••••••••••••••••</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Created {timeAgo(k.created_at)}
                  {k.last_used_at && ` · Last used ${timeAgo(k.last_used_at)}`}
                  {" · "}<span className={k.is_expired ? "text-red-500" : "text-gray-500"}>{formatExpiry(k.expires_at, k.is_expired)}</span>
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 px-3 py-1.5 rounded-lg shrink-0"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Usage docs */}
      <div className="mt-10 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Using the API</h2>
        <p className="text-xs text-gray-400 mb-4">
          Pass your API key as a Bearer token in the <code className="text-indigo-300">Authorization</code> header.
        </p>

        <div className="space-y-4">
          {[
            {
              label: "Submit a YouTube URL",
              code: `curl -X POST http://localhost:8000/api/videos/submit-url \\
  -H "Authorization: Bearer vr_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://youtube.com/watch?v=...", "clips_requested": 5}'`,
            },
            {
              label: "Check job status",
              code: `curl http://localhost:8000/api/jobs/{job_id} \\
  -H "Authorization: Bearer vr_live_your_key_here"`,
            },
            {
              label: "Download a clip",
              code: `curl -OJ http://localhost:8000/api/jobs/{job_id}/clips/{clip_id}/download \\
  -H "Authorization: Bearer vr_live_your_key_here"`,
            },
          ].map(({ label, code }) => (
            <div key={label}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <pre className="bg-gray-950 text-green-300 text-xs p-3 rounded-lg overflow-x-auto font-mono">{code}</pre>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-600 mt-4">
          Full API reference at{" "}
          <a href="http://localhost:8000/docs" target="_blank" className="text-indigo-400 hover:underline">
            localhost:8000/docs
          </a>
        </p>
      </div>
    </div>
  );
}
