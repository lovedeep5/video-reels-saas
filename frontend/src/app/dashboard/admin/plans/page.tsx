"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api, { authApi } from "@/lib/api";

interface Plan {
  _id: string;
  key: string;
  name: string;
  price: number;
  currency: string;
  clips_per_video: number;
  videos_per_month: number;
  max_duration_seconds: number;
  auto_publish: boolean;
  scheduled_publish: boolean;
  features: string[];
  is_active: boolean;
  razorpay_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  key: "",
  name: "",
  price: 0,
  currency: "INR",
  clips_per_video: 3,
  videos_per_month: 2,
  max_duration_seconds: 0,
  auto_publish: false,
  scheduled_publish: false,
  features: "",
  is_active: true,
};

function durationLabel(s: number) {
  if (!s) return "Unlimited";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || `${s}s`;
}

function PlanForm({
  initial,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="bg-gray-700 rounded-xl p-5 border border-gray-600 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {isNew && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Plan Key <span className="text-red-400">*</span></label>
            <input value={form.key} onChange={(e) => set("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="e.g. starter" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            <p className="text-xs text-gray-600 mt-0.5">lowercase, no spaces</p>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Display Name <span className="text-red-400">*</span></label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Starter" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Price (smallest unit, e.g. paise)</label>
          <input type="number" value={form.price} onChange={(e) => set("price", parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <p className="text-xs text-gray-600 mt-0.5">149900 = ₹1,499. 0 = free</p>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Currency</label>
          <input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Clips per Video</label>
          <input type="number" value={form.clips_per_video} onChange={(e) => set("clips_per_video", parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Videos per Month</label>
          <input type="number" value={form.videos_per_month} onChange={(e) => set("videos_per_month", parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <p className="text-xs text-gray-600 mt-0.5">-1 = unlimited</p>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Max Duration (seconds)</label>
          <input type="number" value={form.max_duration_seconds} onChange={(e) => set("max_duration_seconds", parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <p className="text-xs text-gray-600 mt-0.5">0 = unlimited</p>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Features (one per line)</label>
        <textarea value={form.features} onChange={(e) => set("features", e.target.value)}
          rows={4} placeholder={"10 clips per video\n20 videos/month\nYouTube publishing"}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={form.auto_publish} onChange={(e) => set("auto_publish", e.target.checked)} className="accent-blue-500" />
          Auto Publish
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={form.scheduled_publish} onChange={(e) => set("scheduled_publish", e.target.checked)} className="accent-blue-500" />
          Scheduled Publish
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="accent-blue-500" />
          Active
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={() => onSave(form)} disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
          {saving ? "Saving..." : "Save Plan"}
        </button>
        <button onClick={onCancel} className="border border-gray-600 hover:border-gray-400 text-gray-300 text-sm px-4 py-2 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    authApi.me().then((r) => {
      if (!r.data.is_admin) router.replace("/dashboard");
    }).catch(() => router.replace("/dashboard"));

    loadPlans();
  }, []); // eslint-disable-line

  function flash(text: string, type: "success" | "error") {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  async function loadPlans() {
    try {
      const r = await api.get<Plan[]>("/admin/plans");
      setPlans(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(form: typeof EMPTY_FORM) {
    setSavingKey("new");
    try {
      await api.post("/admin/plans", {
        ...form,
        features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      await loadPlans();
      setShowNew(false);
      flash("Plan created", "success");
    } catch (e: any) {
      flash(e?.response?.data?.error || "Failed to create plan", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleEdit(key: string, form: typeof EMPTY_FORM) {
    setSavingKey(key);
    try {
      await api.put(`/admin/plans/${key}`, {
        ...form,
        features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      await loadPlans();
      setEditingKey(null);
      flash("Plan updated", "success");
    } catch (e: any) {
      flash(e?.response?.data?.error || "Failed to update plan", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleDelete(key: string, name: string) {
    if (!confirm(`Delete plan "${name}"? Users on this plan will not be affected immediately.`)) return;
    try {
      await api.delete(`/admin/plans/${key}`);
      await loadPlans();
      flash("Plan deleted", "success");
    } catch (e: any) {
      flash(e?.response?.data?.error || "Failed to delete plan", "error");
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/admin" className="hover:text-white">Admin</Link>
            <span>/</span>
            <span className="text-gray-300">Plans</span>
          </div>
          <h1 className="text-xl font-bold text-white">Plans ({plans.length})</h1>
        </div>
        {!showNew && (
          <button onClick={() => setShowNew(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg">
            + Add Plan
          </button>
        )}
      </div>

      {msg && (
        <div className={`mb-5 px-4 py-2.5 rounded-lg text-sm ${msg.type === "success" ? "bg-green-950 text-green-300 border border-green-800" : "bg-red-950 text-red-300 border border-red-800"}`}>
          {msg.text}
        </div>
      )}

      {/* New plan form */}
      {showNew && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">New Plan</h2>
          <PlanForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setShowNew(false)}
            saving={savingKey === "new"}
            isNew
          />
        </div>
      )}

      {/* Plan cards */}
      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.key} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {editingKey === plan.key ? (
              <div className="p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Editing: {plan.name}</h2>
                <PlanForm
                  initial={{
                    key: plan.key,
                    name: plan.name,
                    price: plan.price,
                    currency: plan.currency,
                    clips_per_video: plan.clips_per_video,
                    videos_per_month: plan.videos_per_month,
                    max_duration_seconds: plan.max_duration_seconds,
                    auto_publish: plan.auto_publish,
                    scheduled_publish: plan.scheduled_publish,
                    features: plan.features.join("\n"),
                    is_active: plan.is_active,
                  }}
                  onSave={(form) => handleEdit(plan.key, form)}
                  onCancel={() => setEditingKey(null)}
                  saving={savingKey === plan.key}
                  isNew={false}
                />
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-white font-semibold">{plan.name}</h2>
                      <span className="text-xs text-gray-500 font-mono bg-gray-700 px-2 py-0.5 rounded">{plan.key}</span>
                      {!plan.is_active && <span className="text-xs bg-red-900 text-red-400 px-2 py-0.5 rounded">Inactive</span>}
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {plan.price === 0 ? "Free" : `₹${(plan.price / 100).toFixed(0)}/mo`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingKey(plan.key)}
                      className="border border-gray-600 hover:border-gray-400 text-gray-300 text-xs px-3 py-1.5 rounded-lg">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(plan.key, plan.name)}
                      className="border border-red-900 hover:border-red-700 text-red-400 text-xs px-3 py-1.5 rounded-lg">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-gray-500 mb-0.5">Clips/video</p>
                    <p className="text-white font-medium">{plan.clips_per_video}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-gray-500 mb-0.5">Videos/month</p>
                    <p className="text-white font-medium">{plan.videos_per_month === -1 ? "Unlimited" : plan.videos_per_month}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-gray-500 mb-0.5">Max Duration</p>
                    <p className="text-white font-medium">{durationLabel(plan.max_duration_seconds)}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-gray-500 mb-0.5">Auto Publish</p>
                    <p className={`font-medium ${plan.auto_publish ? "text-green-400" : "text-gray-500"}`}>{plan.auto_publish ? "Yes" : "No"}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-gray-500 mb-0.5">Scheduled</p>
                    <p className={`font-medium ${plan.scheduled_publish ? "text-green-400" : "text-gray-500"}`}>{plan.scheduled_publish ? "Yes" : "No"}</p>
                  </div>
                </div>

                {plan.features.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="text-xs text-gray-400 bg-gray-700 px-2.5 py-1 rounded-full">✓ {f}</li>
                    ))}
                  </ul>
                )}

                {plan.razorpay_plan_id && (
                  <p className="mt-3 text-xs text-gray-600 font-mono">Razorpay: {plan.razorpay_plan_id}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
