"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api, { authApi } from "@/lib/api";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  job_count: number;
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  business: "bg-purple-900 text-purple-300",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me().then((r) => {
      if (!r.data.is_admin) router.replace("/dashboard");
    }).catch(() => router.replace("/dashboard"));

    api.get<AdminUser[]>("/admin/users")
      .then((r) => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/admin" className="hover:text-white">Admin</Link>
            <span>/</span>
            <span className="text-gray-300">Users</span>
          </div>
          <h1 className="text-xl font-bold text-white">Users ({users.length})</h1>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm mb-5 focus:outline-none focus:border-blue-500"
      />

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Plan</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Jobs</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide hidden md:table-cell">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No users found
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium leading-tight">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${PLAN_BADGE[u.plan] ?? "bg-gray-700 text-gray-300"}`}>
                        {u.plan}
                      </span>
                      {u.is_admin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{u.job_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/admin/users/${u.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300 border border-blue-900 hover:border-blue-700 px-3 py-1.5 rounded-lg"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
