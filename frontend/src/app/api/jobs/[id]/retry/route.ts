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
  const job = await jobs.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }

  // Create a fresh job with the same settings (new _id = new credit debit)
  const result = await jobs.insertOne({
    user_id: user._id!,
    status: "queued",
    source_type: job.source_type,
    source_url: job.source_url,
    clips_requested: job.clips_requested,
    output_ratio: job.output_ratio ?? "9:16",
    progress: 0,
    progress_message: "Queued",
    retry_count: 0,
    created_at: new Date(),
  });

  const newJobId = result.insertedId.toHexString();

  // Enqueue the new job first, then delete the old one
  await enqueueJob(newJobId);
  await jobs.deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ message: "Retrying as new job", new_job_id: newJobId });
}
