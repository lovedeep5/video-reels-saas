import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { enqueueJob } from "@/lib/sqs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const jobs = await jobsCol();
  // Admins can retry any job; regular users only their own
  const filter = user.is_admin
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), user_id: user._id };
  const job = await jobs.findOne(filter);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!user.is_admin && job.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }

  // Build new job doc — always assigned to original user
  const isAdminRetryingOther = user.is_admin && !job.user_id.equals(user._id);
  const newDoc: Record<string, unknown> = {
    user_id: job.user_id,
    status: "queued",
    source_type: job.source_type,
    source_url: job.source_url,
    clips_requested: job.clips_requested,
    output_ratio: job.output_ratio ?? "9:16",
    include_captions: job.include_captions ?? false,
    // Preserve faceless-specific fields
    ...(job.faceless_topic && { faceless_topic: job.faceless_topic }),
    ...(job.faceless_script_type && { faceless_script_type: job.faceless_script_type }),
    ...(job.faceless_style && { faceless_style: job.faceless_style }),
    ...(job.faceless_voice && { faceless_voice: job.faceless_voice }),
    ...(job.faceless_duration && { faceless_duration: job.faceless_duration }),
    ...(job.faceless_music && { faceless_music: job.faceless_music }),
    ...(job.faceless_text_style && { faceless_text_style: job.faceless_text_style }),
    ...(job.video_title && { video_title: job.video_title }),
    progress: 0,
    progress_message: "Queued",
    retry_count: 0,
    created_at: new Date(),
  };
  if (isAdminRetryingOther) {
    newDoc.admin_retry_user_id = user._id!.toString();
  }

  const result = await jobs.insertOne(newDoc as any);
  const newJobId = result.insertedId.toHexString();

  // Enqueue the new job first, then delete the old one
  await enqueueJob(newJobId);
  await jobs.deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ message: "Retrying as new job", new_job_id: newJobId });
}
