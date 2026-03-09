"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { jobsApi, Job } from "@/lib/api";
import ProcessingProgress from "@/components/ProcessingProgress";
import ClipCard from "@/components/ClipCard";

const TERMINAL = ["completed", "failed"];

function isBotDetectionError(msg: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("sign in") ||
    lower.includes("bot") ||
    lower.includes("confirm you") ||
    lower.includes("cookies") ||
    lower.includes("private video") ||
    lower.includes("age-restricted")
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = String(params.id);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const jobRef = useRef<Job | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchJob() {
      try {
        const res = await jobsApi.get(jobId);
        if (cancelled) return;
        setJob(res.data);
        jobRef.current = res.data;
      } catch {
        if (!cancelled) router.push("/dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJob();

    const interval = setInterval(() => {
      if (jobRef.current && TERMINAL.includes(jobRef.current.status)) return;
      fetchJob();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]); // eslint-disable-line

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading...</div>;
  }
  if (!job) return null;

  const title = job.video_title || job.source_filename || job.source_url || `Job #${job.id}`;

  async function handleDelete() {
    if (!confirm("Delete this failed job? This will remove all downloaded files and free up your usage slot.")) return;
    setDeleting(true);
    try {
      await jobsApi.deleteFailed(jobId);
      router.push("/dashboard");
    } catch {
      setDeleting(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await jobsApi.retry(jobId);
      const newJobId = res.data?.new_job_id;
      if (newJobId) {
        router.push(`/dashboard/jobs/${newJobId}`);
      }
    } catch {
      setRetrying(false);
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-300 truncate max-w-xs">{title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold truncate max-w-lg">{title}</h1>
          {job.source_url && (
            <p className="text-sm text-gray-500 truncate mt-0.5 max-w-md">{job.source_url}</p>
          )}
          {job.video_duration && (
            <p className="text-xs text-gray-600 mt-1">
              {Math.round(job.video_duration / 60)}m {Math.round(job.video_duration % 60)}s source video
            </p>
          )}
        </div>
        {job.status === "failed" && (
          <div className="flex gap-2 shrink-0 ml-4">
            <button
              onClick={handleRetry}
              disabled={retrying || deleting}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {retrying ? "Retrying..." : "Retry"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || retrying}
              className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
      </div>

      {/* Progress */}
      {!TERMINAL.includes(job.status) && (
        <div className="mb-8">
          <ProcessingProgress
            status={job.status}
            progress={job.progress}
            message={job.progress_message}
            error={job.error_message}
          />
          <p className="text-xs text-gray-600 mt-2">This page auto-refreshes every 15 seconds</p>
        </div>
      )}

      {/* Failed state */}
      {job.status === "failed" && (
        <div className="mb-8 space-y-3">
          <div className="bg-red-950 border border-red-800 rounded-xl p-5">
            <p className="text-red-300 font-medium mb-1">Processing failed</p>
            <p className="text-red-400 text-sm">{job.error_message}</p>
          </div>

          {/* Bot detection help banner */}
          {isBotDetectionError(job.error_message) && (
            <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-5">
              <p className="text-yellow-300 font-semibold mb-1">YouTube blocked the download</p>
              <p className="text-yellow-400 text-sm mb-3">
                YouTube requires a signed-in session to download this video from our servers.
                Install our Chrome extension to sync your YouTube cookies — then retry.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://vidtoreels.com/extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-medium py-1.5 px-3 rounded-lg"
                >
                  Install Chrome Extension
                </a>
                <a
                  href="/dashboard/settings"
                  className="inline-flex items-center gap-1.5 border border-yellow-700 text-yellow-400 hover:text-yellow-300 text-xs font-medium py-1.5 px-3 rounded-lg"
                >
                  Already installed? Check Settings
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clips grid */}
      {job.status === "completed" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {job.clips.length} Reel{job.clips.length !== 1 ? "s" : ""} Ready
            </h2>
            <span className="text-xs text-gray-500">9:16 vertical · subtitles included</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {job.clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} jobId={job.id} videoTitle={job.video_title} />
            ))}
          </div>
        </div>
      )}

      {/* Partial clips (some rendered) */}
      {job.status !== "completed" && job.clips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Clips (partial)</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {job.clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} jobId={job.id} videoTitle={job.video_title} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
