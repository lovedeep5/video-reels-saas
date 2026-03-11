import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
    error_type: job.error_type ?? null,
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
        youtube_video_id: meta?.youtube_video_id ?? null,
        youtube_url: meta?.youtube_url ?? null,
        yt_title: meta?.yt_title ?? null,
        yt_description: meta?.yt_description ?? null,
        yt_tags: meta?.yt_tags ?? [],
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
  const filter = user.is_admin
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), user_id: user._id };
  const job = await jobs.findOne(filter);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(serializeJob(job));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const jobs = await jobsCol();
  // Admins can find any job; regular users only their own
  const filter = user.is_admin
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), user_id: user._id };
  const job = await jobs.findOne(filter);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!user.is_admin && job.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be deleted" }, { status: 400 });
  }

  // Delete S3 clips if any
  const s3Keys: string[] = job.output_clips ?? [];
  if (s3Keys.length > 0) {
    await Promise.all(
      s3Keys.map((key) =>
        s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }))
      )
    );
  }

  await jobs.deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ message: "Job deleted" });
}
