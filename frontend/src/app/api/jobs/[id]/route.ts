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
    clips: (job.output_clips ?? []).map((s3Key: string, i: number) => {
      // Use rich metadata saved by run_job.py if available (new jobs)
      const meta = job.output_clip_metadata?.[i];
      return {
        id: i,
        clip_index: i,
        s3_key: s3Key,
        file_ready: true,
        start_time: meta?.start_time ?? 0,
        end_time: meta?.end_time ?? 0,
        duration: meta?.duration ?? 0,
        importance_score: meta?.importance_score ?? 0,
        transcript_excerpt: meta?.transcript_excerpt ?? null,
      };
    }),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(serializeJob(job));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be deleted" }, { status: 400 });
  }

  await jobs.deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ message: "Job deleted" });
}
