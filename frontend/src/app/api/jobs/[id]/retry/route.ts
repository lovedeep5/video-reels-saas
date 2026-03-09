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

  if (!["failed", "starting"].includes(job.status)) {
    return NextResponse.json({ error: "Only failed or stuck jobs can be retried" }, { status: 400 });
  }

  // Reset job to queued state, increment retry_count
  await jobs.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "queued",
        progress: 0,
        progress_message: "Queued for retry",
        error_message: null,
        completed_at: null,
        ec2_instance_id: null,
        started_at: null,
      },
      $inc: { retry_count: 1 },
    }
  );

  await enqueueJob(id);

  return NextResponse.json({ message: "Job re-queued" });
}
