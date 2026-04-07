"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { jobsApi, Job, Usage } from "@/lib/api";
import { getPlanMeta } from "@/lib/auth";

function statusColor(status: string) {
  if (status === "completed") return "bg-green-900/60 text-green-300";
  if (status === "failed")    return "bg-red-900/60 text-red-300";
  if (status === "queued")    return "bg-gray-700 text-gray-400";
  return "bg-indigo-900/60 text-indigo-300";
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function jobLabel(job: Job) {
  if (job.source_type === "faceless") return "AI Video";
  return "YouTube Clips";
}

export default function DashboardPage() {
  const [jobs, setJobs]   = useState<Job[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const jobsRef = useRef(jobs);
  const isAdmin = getPlanMeta()?.is_admin;

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  useEffect(() => {
    Promise.all([jobsApi.list(), jobsApi.usage()]).then(([jr, ur]) => {
      setJobs(jr.data);
      setUsage(ur.data);
      setLoading(false);
    });

    const interval = setInterval(() => {
      const needsRefresh = jobsRef.current.some(
        (j) => !["completed", "failed"].includes(j.status)
      );
      if (needsRefresh) {
        jobsApi.list().then((r) => setJobs(r.data));
        jobsApi.usage().then((r) => setUsage(r.data));
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-2" : ""}`}>
        <Link
          href="/dashboard/faceless"
          className="group flex items-center gap-4 bg-gradient-to-br from-purple-950/60 via-gray-900 to-gray-900 border border-purple-900/40 hover:border-purple-600/60 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-purple-950/20"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-900/60 border border-purple-800/50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">Create AI Video</p>
            <p className="text-xs text-gray-500 mt-0.5">Type a topic → AI writes, illustrates &amp; narrates</p>
          </div>
          <svg className="w-4 h-4 text-purple-400 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </Link>

        {isAdmin && (
          <Link
            href="/dashboard/upload"
            className="group flex items-center gap-4 bg-gradient-to-br from-red-950/60 via-gray-900 to-gray-900 border border-red-900/40 hover:border-red-600/60 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-red-950/20"
          >
            <div className="w-11 h-11 rounded-xl bg-red-900/60 border border-red-800/50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">YouTube Clips</p>
              <p className="text-xs text-gray-500 mt-0.5">Paste a YouTube URL → get vertical clips</p>
            </div>
            <svg className="w-4 h-4 text-red-400 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </Link>
        )}
      </div>

      {/* ── Usage bar ────────────────────────────────────────────────────── */}
      {usage && (
        <div className="flex flex-wrap gap-4 items-center bg-gray-900/60 border border-gray-800 rounded-xl px-5 py-3.5">
          <div className="flex-1 min-w-40">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Videos this month</span>
              <span className="font-medium text-white">
                {usage.videos_used} / {usage.videos_limit === -1 ? "∞" : usage.videos_limit}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.videos_limit !== -1 && usage.videos_used >= usage.videos_limit
                    ? "bg-red-500"
                    : "bg-indigo-500"
                }`}
                style={{
                  width: usage.videos_limit === -1
                    ? "0%"
                    : `${Math.min(100, (usage.videos_used / usage.videos_limit) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span className="capitalize text-gray-300 font-medium">{usage.plan}</span> plan
            {usage.videos_limit !== -1 && usage.videos_used >= usage.videos_limit && (
              <Link href="/billing" className="text-indigo-400 hover:underline">Upgrade →</Link>
            )}
          </div>
        </div>
      )}

      {/* ── Job list ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Videos</h2>

        {loading && (
          <div className="text-gray-500 text-sm">Loading...</div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="text-center py-14 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/30">
            <p className="text-sm">No videos yet</p>
            <Link href="/dashboard/faceless" className="text-xs text-indigo-400 hover:underline mt-1 inline-block">Create your first AI video →</Link>
          </div>
        )}

        <div className="space-y-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}`}
              className="flex items-center gap-3 bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3.5 transition-colors"
            >
              {/* Type icon */}
              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                job.source_type === "faceless" ? "bg-purple-900/60 text-purple-400" : "bg-red-900/60 text-red-400"
              }`}>
                {job.source_type === "faceless" ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {job.video_title || job.source_filename || job.source_url || `Video #${job.id.slice(-6)}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {jobLabel(job)} · {timeAgo(job.created_at)}
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2.5 shrink-0">
                {!["completed", "failed"].includes(job.status) && (
                  <div className="w-20 bg-gray-800 rounded-full h-1">
                    <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${job.progress}%` }} />
                  </div>
                )}
                {job.status === "completed" && (
                  <span className="text-xs text-green-400">{job.clips.length} clip{job.clips.length !== 1 ? "s" : ""}</span>
                )}
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
