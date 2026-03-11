import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { enqueueJob } from "@/lib/sqs";
import { getPlan, BILLABLE_STATUSES } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { url, clips_requested = 5, output_ratio = "9:16", include_captions = false } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Plan limits check — admins have no limits
  const plan = getPlan(user.plan);
  if (!user.is_admin) {
    if (plan.videos_per_month !== -1) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const jobs = await jobsCol();
      const used = await jobs.countDocuments({
        user_id: user._id,
        created_at: { $gte: startOfMonth },
        status: { $in: [...BILLABLE_STATUSES] },
      });

      if (used >= plan.videos_per_month) {
        return NextResponse.json(
          { error: `Monthly video limit reached (${used}/${plan.videos_per_month}). Upgrade your plan.` },
          { status: 403 }
        );
      }
    }
  }

  const clips = user.is_admin ? clips_requested : Math.min(clips_requested, plan.clips_per_video);

  const jobs = await jobsCol();
  const result = await jobs.insertOne({
    user_id: user._id!,
    status: "queued",
    source_type: "url",
    source_url: url,
    clips_requested: clips,
    output_ratio,
    include_captions: Boolean(include_captions),
    progress: 0,
    progress_message: "Queued",
    retry_count: 0,
    created_at: new Date(),
  });

  const jobId = result.insertedId.toHexString();

  // Send to SQS — Lambda dispatcher will pick it up and start an EC2
  await enqueueJob(jobId);

  return NextResponse.json({ job_id: jobId, message: "Job created and queued" }, { status: 201 });
}
