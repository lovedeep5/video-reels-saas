"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { jobsApi, Job, Usage } from "@/lib/api";

function statusColor(status: string) {
  switch (status) {
    case "completed": return "bg-green-900 text-green-300";
    case "failed": return "bg-red-900 text-red-300";
    case "pending": return "bg-gray-700 text-gray-300";
    default: return "bg-indigo-900 text-indigo-300";
  }
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([jobsApi.list(), jobsApi.usage()]).then(([jr, ur]) => {
      setJobs(jr.data);
      setUsage(ur.data);
      setLoading(false);
    });
    // Refresh every 5s if any job is in progress
    const interval = setInterval(() => {
      const needsRefresh = jobs.some(
        (j) => !["completed", "failed"].includes(j.status)
      );
      if (needsRefresh) {
        jobsApi.list().then((r) => setJobs(r.data));
        jobsApi.usage().then((r) => setUsage(r.data));
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [jobs.length]); // eslint-disable-line

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Videos</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/upload"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            + New Video
          </Link>
        </div>
      </div>

      {/* Usage bar */}
      {usage && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-6 items-center">
          <div className="flex-1 min-w-48">
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
          <div className="text-xs text-gray-500">
            <span className="text-gray-300 font-medium capitalize">{usage.plan}</span> plan
            &nbsp;·&nbsp;up to <span className="text-gray-300 font-medium">{usage.clips_per_video} clips</span> per video
            {usage.videos_limit !== -1 && usage.videos_used >= usage.videos_limit && (
              <Link href="/billing" className="ml-3 text-indigo-400 hover:underline">Upgrade →</Link>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm">Loading...</div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-4">No videos yet</p>
          <Link href="/dashboard/upload" className="text-indigo-400 hover:underline text-sm">
            Submit your first video
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-5 py-4 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {job.video_title || job.source_filename || job.source_url || `Job #${job.id}`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {timeAgo(job.created_at)}
                {job.video_duration && ` · ${Math.round(job.video_duration / 60)}m video`}
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              {job.status !== "completed" && job.status !== "failed" && (
                <div className="w-24 bg-gray-800 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${job.progress}%` }} />
                </div>
              )}
              {job.status === "completed" && (
                <span className="text-xs text-green-400">{job.clips.length} clips</span>
              )}
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
