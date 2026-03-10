"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { authApi } from "@/lib/api";

interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  plan: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  jobs: {
    id: string;
    status: string;
    source_url: string | null;
    video_title: string | null;
    created_at: string;
    clip_count: number;
    output_ratio: string;
  }[];
}

interface PlanOption {
  key: string;
  name: string;
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  business: "bg-purple-900 text-purple-300",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
  queued: "bg-yellow-900 text-yellow-300",
  starting: "bg-yellow-900 text-yellow-300",
  downloading: "bg-blue-900 text-blue-300",
  processing: "bg-blue-900 text-blue-300",
  rendering: "bg-purple-900 text-purple-300",
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = String(params.id);

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    authApi.me().then((r) => {
      if (!r.data.is_admin) router.replace("/dashboard");
      setMyId(r.data.id);
    }).catch(() => router.replace("/dashboard"));

    Promise.all([
      api.get<AdminUserDetail>(`/admin/users/${userId}`),
      api.get<PlanOption[]>("/admin/plans"),
    ]).then(([userRes, plansRes]) => {
      setUser(userRes.data);
      setSelectedPlan(userRes.data.plan);
      setPlans(plansRes.data.map((p: any) => ({ key: p.key, name: p.name })));
    }).catch(() => router.replace("/dashboard/admin/users"))
      .finally(() => setLoading(false));
  }, [userId]); // eslint-disable-line

  function flash(text: string, type: "success" | "error") {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleSavePlan() {
    setSavingPlan(true);
    try {
      await api.patch(`/admin/users/${userId}/plan`, { plan: selectedPlan });
      setUser((u) => u ? { ...u, plan: selectedPlan } : u);
      flash("Plan updated", "success");
    } catch {
      flash("Failed to update plan", "error");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleToggleAdmin() {
    if (!user) return;
    setTogglingAdmin(true);
    const newVal = !user.is_admin;
    try {
      await api.patch(`/admin/users/${userId}/admin`, { is_admin: newVal });
      setUser((u) => u ? { ...u, is_admin: newVal } : u);
      flash(`Admin ${newVal ? "granted" : "revoked"}`, "success");
    } catch (e: any) {
      flash(e?.response?.data?.error || "Failed", "error");
    } finally {
      setTogglingAdmin(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete user "${user?.name}" and all their jobs? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      router.push("/dashboard/admin/users");
    } catch {
      flash("Failed to delete user", "error");
      setDeleting(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  if (!user) return null;

  const isSelf = myId === userId;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard/admin" className="hover:text-white">Admin</Link>
        <span>/</span>
        <Link href="/dashboard/admin/users" className="hover:text-white">Users</Link>
        <span>/</span>
        <span className="text-gray-300 truncate max-w-xs">{user.name}</span>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${msg.type === "success" ? "bg-green-950 text-green-300 border border-green-800" : "bg-red-950 text-red-300 border border-red-800"}`}>
          {msg.text}
        </div>
      )}

      {/* User header */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{user.email}</p>
            <p className="text-gray-600 text-xs mt-1">Joined {new Date(user.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full capitalize ${PLAN_BADGE[user.plan] ?? "bg-gray-700 text-gray-300"}`}>
              {user.plan}
            </span>
            {user.is_admin && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-900 text-yellow-300">Admin</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 pt-5 border-t border-gray-700 flex flex-wrap gap-3 items-end">
          {/* Change plan */}
          <div className="flex items-center gap-2">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {plans.map((p) => (
                <option key={p.key} value={p.key}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleSavePlan}
              disabled={savingPlan || selectedPlan === user.plan}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
            >
              {savingPlan ? "Saving..." : "Change Plan"}
            </button>
          </div>

          {/* Toggle admin */}
          <button
            onClick={handleToggleAdmin}
            disabled={togglingAdmin || isSelf}
            title={isSelf ? "You can't change your own admin status" : undefined}
            className="border border-yellow-800 hover:border-yellow-600 text-yellow-400 hover:text-yellow-300 disabled:opacity-40 text-sm px-4 py-2 rounded-lg"
          >
            {togglingAdmin ? "Updating..." : user.is_admin ? "Revoke Admin" : "Grant Admin"}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting || isSelf}
            title={isSelf ? "You can't delete yourself" : undefined}
            className="border border-red-900 hover:border-red-700 text-red-400 hover:text-red-300 disabled:opacity-40 text-sm px-4 py-2 rounded-lg ml-auto"
          >
            {deleting ? "Deleting..." : "Delete User"}
          </button>
        </div>
      </div>

      {/* Jobs table */}
      <h2 className="text-sm font-semibold text-white mb-3">Jobs ({user.jobs.length})</h2>
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {user.jobs.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">No jobs yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Title / URL</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Clips</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {user.jobs.map((job) => (
                <tr key={job.id} className="border-t border-gray-700">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-white truncate">{job.video_title || job.source_url || `Job #${job.id.slice(-6)}`}</p>
                    {job.source_url && job.video_title && (
                      <p className="text-xs text-gray-600 truncate">{job.source_url}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status] ?? "bg-gray-700 text-gray-300"}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{job.clip_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
