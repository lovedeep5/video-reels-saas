import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";

function serializeJob(job: any) {
  return {
    id: job._id.toHexString(),
    status: job.status,
    progress: job.progress ?? 0,
    progress_message: job.progress_message ?? "",
    source_type: job.source_type,
    source_url: job.source_url ?? null,
    source_filename: job.source_filename ?? null,
    video_title: job.video_title ?? null,
    video_duration: job.video_duration ?? null,
    clips_requested: job.clips_requested,
    output_ratio: job.output_ratio ?? "9:16",
    error_message: job.error_message ?? null,
    created_at: job.created_at?.toISOString() ?? null,
    completed_at: job.completed_at?.toISOString() ?? null,
    clips: (job.output_clips ?? []).map((s3Key: string, i: number) => ({
      id: i,
      clip_index: i,
      s3_key: s3Key,
      file_ready: true,
      start_time: 0,
      end_time: 0,
      duration: 0,
      importance_score: 0,
      transcript_excerpt: null,
    })),
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await jobsCol();
  const list = await jobs
    .find({ user_id: user._id })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json(list.map(serializeJob));
}
