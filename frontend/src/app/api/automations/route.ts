import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { automationsCol, automationRunsCol, ObjectId, getChannels } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const col = await automationsCol();
  const runs = await automationRunsCol();

  const automations = await col.find({ user_id: user._id }).sort({ created_at: -1 }).toArray();

  // Attach latest run for each automation
  const items = await Promise.all(automations.map(async (a) => {
    const latestRun = await runs.findOne(
      { automation_id: a._id },
      { sort: { scheduled_post_at: -1 } }
    );
    const nextRun = await runs.findOne(
      { automation_id: a._id, status: "pending" },
      { sort: { scheduled_post_at: 1 } }
    );
    return {
      id: a._id!.toHexString(),
      name: a.name,
      is_active: a.is_active,
      topics: a.topics,
      topic_index: a.topic_index,
      script_type: a.script_type,
      style: a.style,
      voice: a.voice,
      music: a.music,
      duration: a.duration,
      post_hour: a.post_hour,
      platforms: a.platforms,
      visibility: a.visibility,
      total_runs: a.total_runs,
      latest_run: latestRun ? {
        status: latestRun.status,
        topic: latestRun.topic,
        scheduled_post_at: latestRun.scheduled_post_at.toISOString(),
        job_id: latestRun.job_id?.toHexString() ?? null,
      } : null,
      next_run_at: nextRun?.scheduled_post_at.toISOString() ?? null,
      created_at: a.created_at.toISOString(),
    };
  }));

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Plan gate: Pro/Business only
  if (!user.is_admin && !["pro", "business"].includes(user.plan)) {
    return NextResponse.json({ error: "Automations are available on Pro and Business plans" }, { status: 403 });
  }

  const body = await req.json();
  const { name, topics, script_type, style, voice, music, duration, post_hour, platforms, visibility } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json({ error: "At least 1 topic is required" }, { status: 400 });
  }
  if (typeof post_hour !== "number" || post_hour < 0 || post_hour > 23) {
    return NextResponse.json({ error: "post_hour must be 0-23" }, { status: 400 });
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: "At least 1 publishing platform is required" }, { status: 400 });
  }

  // Validate channels exist
  const channels = getChannels(user);
  for (const p of platforms) {
    if (!channels.some((c) => c.id === p.channel_id && c.platform === p.platform)) {
      return NextResponse.json({ error: `Channel ${p.channel_id} not found` }, { status: 400 });
    }
  }

  const col = await automationsCol();
  const runs = await automationRunsCol();
  const now = new Date();

  const doc = {
    user_id: user._id!,
    name: name.trim(),
    is_active: true,
    topics: topics.filter((t: string) => t.trim()).map((t: string) => t.trim()),
    topic_index: 0,
    script_type: script_type || "story",
    style: style || "creepy-comic",
    voice: voice || "andrew",
    music: music || "none",
    duration: duration || 30,
    post_hour,
    platforms,
    visibility: visibility || "public",
    total_runs: 0,
    created_at: now,
    updated_at: now,
  };

  const result = await col.insertOne(doc);

  // Create first run for tomorrow at post_hour
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(post_hour, 0, 0, 0);

  await runs.insertOne({
    automation_id: result.insertedId,
    user_id: user._id!,
    scheduled_post_at: tomorrow,
    topic: doc.topics[0],
    status: "pending",
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({
    id: result.insertedId.toHexString(),
    next_run_at: tomorrow.toISOString(),
    message: `Automation created. First video will be posted tomorrow at ${post_hour}:00 UTC.`,
  }, { status: 201 });
}
