import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { scheduledPublishesCol, jobsCol, ObjectId, getChannels } from "@/lib/mongodb";
import { getPlan } from "@/lib/plans";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");

  const col = await scheduledPublishesCol();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { user_id: user._id };
  if (status) filter.status = status;
  if (platform) filter.platform = platform;

  const docs = await col
    .find(filter)
    .sort({ scheduled_at: 1 })
    .limit(100)
    .toArray();

  const items = docs.map((d) => ({
    id: d._id!.toHexString(),
    job_id: d.job_id.toHexString(),
    clip_index: d.clip_index,
    platform: d.platform,
    channel_id: d.channel_id,
    title: d.title ?? null,
    description: d.description ?? null,
    tags: d.tags ?? [],
    visibility: d.visibility ?? null,
    scheduled_at: d.scheduled_at.toISOString(),
    status: d.status,
    error_message: d.error_message ?? null,
    published_url: d.published_url ?? null,
    platform_id: d.platform_id ?? null,
    published_at: d.published_at?.toISOString() ?? null,
    created_at: d.created_at.toISOString(),
  }));

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Plan check — scheduling requires creator/pro/business or admin
  const plan = getPlan(user.plan);
  if (!user.is_admin && !("scheduled_publish" in plan && plan.scheduled_publish)) {
    return NextResponse.json(
      { error: "Scheduled publishing is available on Creator, Pro, and Business plans" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { job_id, clip_index, platform, channel_id, scheduled_at, title, description, tags, visibility } = body;

  // Validate required fields
  if (!job_id || typeof clip_index !== "number" || !platform || !channel_id || !scheduled_at) {
    return NextResponse.json(
      { error: "job_id, clip_index, platform, channel_id, and scheduled_at are required" },
      { status: 400 }
    );
  }

  if (!["youtube", "instagram"].includes(platform)) {
    return NextResponse.json({ error: "Platform must be youtube or instagram" }, { status: 400 });
  }

  // Validate job ownership and completion
  if (!ObjectId.isValid(job_id)) {
    return NextResponse.json({ error: "Invalid job_id" }, { status: 400 });
  }

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: new ObjectId(job_id) });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!user.is_admin && !job.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not your job" }, { status: 403 });
  }
  if (job.status !== "completed") {
    return NextResponse.json({ error: "Job must be completed before scheduling" }, { status: 400 });
  }

  const clipCount = job.output_clips?.length ?? 0;
  if (clip_index < 0 || clip_index >= clipCount) {
    return NextResponse.json({ error: `clip_index must be 0-${clipCount - 1}` }, { status: 400 });
  }

  // Validate channel exists
  const channels = getChannels(user);
  const channel = channels.find((c) => c.id === channel_id && c.platform === platform);
  if (!channel) {
    return NextResponse.json({ error: `No ${platform} channel found with id ${channel_id}` }, { status: 400 });
  }

  // Validate scheduled_at is in the future (at least 1 minute)
  const schedDate = new Date(scheduled_at);
  if (isNaN(schedDate.getTime())) {
    return NextResponse.json({ error: "Invalid scheduled_at date" }, { status: 400 });
  }
  if (schedDate.getTime() < Date.now() + 60_000) {
    return NextResponse.json({ error: "scheduled_at must be at least 1 minute in the future" }, { status: 400 });
  }

  const col = await scheduledPublishesCol();
  const now = new Date();

  const doc = {
    user_id: user._id!,
    job_id: new ObjectId(job_id),
    clip_index,
    platform: platform as "youtube" | "instagram",
    channel_id,
    title: title ?? undefined,
    description: description ?? undefined,
    tags: Array.isArray(tags) ? tags : undefined,
    visibility: visibility ?? undefined,
    scheduled_at: schedDate,
    status: "scheduled" as const,
    created_at: now,
    updated_at: now,
  };

  const result = await col.insertOne(doc);

  return NextResponse.json({
    id: result.insertedId.toHexString(),
    ...doc,
    user_id: doc.user_id.toHexString(),
    job_id: doc.job_id.toHexString(),
    scheduled_at: doc.scheduled_at.toISOString(),
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  }, { status: 201 });
}
