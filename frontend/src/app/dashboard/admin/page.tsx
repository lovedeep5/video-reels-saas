"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api, { authApi } from "@/lib/api";

interface Stats {
  total_users: number;
  admin_users: number;
  jobs_today: number;
  jobs_week: number;
  jobs_total: number;
  jobs_by_status: Record<string, number>;
  plan_breakdown: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
  queued: "bg-yellow-900 text-yellow-300",
  starting: "bg-yellow-900 text-yellow-300",
  downloading: "bg-blue-900 text-blue-300",
  processing: "bg-blue-900 text-blue-300",
  rendering: "bg-purple-900 text-purple-300",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  business: "bg-purple-900 text-purple-300",
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerText, setBannerText] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerSaved, setBannerSaved] = useState(false);

  useEffect(() => {
    authApi.me().then((r) => {
      if (!r.data.is_admin) router.replace("/dashboard");
    }).catch(() => router.replace("/dashboard"));

    api.get<Stats>("/admin/stats")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<{ text: string }>("/admin/notification")
      .then((r) => setBannerText(r.data.text))
      .catch(() => {});
  }, []); // eslint-disable-line

  async function saveBanner() {
    setBannerSaving(true);
    setBannerSaved(false);
    try {
      await api.put("/admin/notification", { text: bannerText });
      setBannerSaved(true);
      setTimeout(() => setBannerSaved(false), 2500);
    } catch {
      // ignore
    } finally {
      setBannerSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  if (!stats) return null;

  const statusOrder = ["completed", "failed", "queued", "starting", "downloading", "processing", "rendering"];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of users, jobs, and plans</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/admin/users" className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm px-4 py-2 rounded-lg">
            Manage Users
          </Link>
          <Link href="/dashboard/admin/plans" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg">
            Manage Plans
          </Link>
        </div>
      </div>

      {/* Notification banner editor */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-white mb-1">Notification Banner</h2>
        <p className="text-xs text-gray-500 mb-3">Shown to all users at the top of the dashboard. Leave empty to hide.</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            placeholder="e.g. App is currently in beta — some features may change."
            className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 placeholder-gray-600"
          />
          <button
            onClick={saveBanner}
            disabled={bannerSaving}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            {bannerSaving ? "Saving…" : bannerSaved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Admin Users" value={stats.admin_users} />
        <StatCard label="Jobs Today" value={stats.jobs_today} />
        <StatCard label="Jobs This Week" value={stats.jobs_week} />
        <StatCard label="Jobs Total" value={stats.jobs_total} />
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Jobs by status */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Jobs by Status</h2>
          <div className="space-y-2">
            {statusOrder.map((status) => {
              const count = stats.jobs_by_status[status] ?? 0;
              const total = stats.jobs_total || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-700 text-gray-300"}`}>
                      {status}
                    </span>
                    <span className="text-sm text-white font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plan breakdown */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Users by Plan</h2>
          <div className="space-y-3">
            {Object.entries(stats.plan_breakdown).map(([plan, count]) => {
              const total = stats.total_users || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[plan] ?? "bg-gray-700 text-gray-300"}`}>
                      {plan}
                    </span>
                    <span className="text-sm text-white font-medium">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
