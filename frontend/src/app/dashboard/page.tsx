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

function FeatureCards() {
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-8">
      {/* YouTube to Clips */}
      <Link
        href="/dashboard/upload"
        className="group relative overflow-hidden bg-gradient-to-br from-red-950/60 via-gray-900 to-gray-900 border border-red-900/40 hover:border-red-700/60 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-red-950/20"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-800/50 flex items-center justify-center text-lg">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">YouTube to Clips</h3>
              <span className="text-xs text-gray-500">Paste a URL, get viral clips</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            AI analyzes any YouTube video, picks the best moments, and renders vertical clips ready for Shorts, Reels, or TikTok.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">
            Create clips
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </span>
        </div>
      </Link>

      {/* Faceless Videos */}
      <Link
        href="/dashboard/faceless"
        className="group relative overflow-hidden bg-gradient-to-br from-purple-950/60 via-gray-900 to-gray-900 border border-purple-900/40 hover:border-purple-700/60 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-purple-950/20"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-800/50 flex items-center justify-center text-lg">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">AI Faceless Videos</h3>
              <span className="text-xs text-purple-400/80 font-medium">NEW</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            Type a topic — AI writes the script, generates images, adds voiceover and music to create a complete faceless video.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-400 group-hover:text-purple-300 transition-colors">
            Create faceless video
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </span>
        </div>
      </Link>
    </div>
  );
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
    // Refresh every 15s if any job is in progress
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
      {/* Feature cards — always visible */}
      <FeatureCards />

      {/* Usage bar */}
      {usage && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-6 items-center">
          <div className="flex-1 min-w-48">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Videos this month</span>
              <span className="font-medium text-white">
                {usage.videos_used} / {usage.videos_limit === -1 ? "\u221E" : usage.videos_limit}
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
            &nbsp;&middot;&nbsp;up to <span className="text-gray-300 font-medium">{usage.clips_per_video} clips</span> per video
            {usage.videos_limit !== -1 && usage.videos_used >= usage.videos_limit && (
              <Link href="/billing" className="ml-3 text-indigo-400 hover:underline">Upgrade &rarr;</Link>
            )}
          </div>
        </div>
      )}

      {/* Jobs header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Recent Videos</h2>
      </div>

      {loading && (
        <div className="text-gray-400 text-sm">Loading...</div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="text-center py-16 text-gray-500 bg-gray-900/50 border border-gray-800 rounded-xl">
          <p className="text-base mb-2">No videos yet</p>
          <p className="text-sm text-gray-600">Create your first video using one of the options above</p>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-5 py-4 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Source type badge */}
              <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                job.source_type === "faceless"
                  ? "bg-purple-900/50 text-purple-400"
                  : "bg-red-900/50 text-red-400"
              }`}>
                {job.source_type === "faceless" ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                )}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {job.video_title || job.source_filename || job.source_url || `Job #${job.id}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.source_type === "faceless" ? "Faceless" : "YouTube clip"}
                  {" \u00B7 "}{timeAgo(job.created_at)}
                  {job.video_duration && ` \u00B7 ${Math.round(job.video_duration / 60)}m video`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              {job.status !== "completed" && job.status !== "failed" && (
                <div className="w-24 bg-gray-800 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${job.progress}%` }} />
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
  );
}
