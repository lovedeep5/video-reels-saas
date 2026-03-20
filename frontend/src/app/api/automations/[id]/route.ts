import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { automationsCol, automationRunsCol, ObjectId } from "@/lib/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const col = await automationsCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.is_admin && !doc.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  // Get recent runs
  const runs = await automationRunsCol();
  const recentRuns = await runs.find({ automation_id: doc._id })
    .sort({ scheduled_post_at: -1 })
    .limit(14)
    .toArray();

  return NextResponse.json({
    id: doc._id!.toHexString(),
    name: doc.name,
    is_active: doc.is_active,
    topics: doc.topics,
    topic_index: doc.topic_index,
    script_type: doc.script_type,
    style: doc.style,
    voice: doc.voice,
    music: doc.music,
    duration: doc.duration,
    post_hour: doc.post_hour,
    platforms: doc.platforms,
    visibility: doc.visibility,
    total_runs: doc.total_runs,
    created_at: doc.created_at.toISOString(),
    runs: recentRuns.map((r) => ({
      id: r._id!.toHexString(),
      status: r.status,
      topic: r.topic,
      scheduled_post_at: r.scheduled_post_at.toISOString(),
      job_id: r.job_id?.toHexString() ?? null,
      error_message: r.error_message ?? null,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const col = await automationsCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.is_admin && !doc.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { updated_at: new Date() };

  if (body.name !== undefined) update.name = body.name;
  if (body.is_active !== undefined) {
    update.is_active = body.is_active;
    // If resuming, create a new pending run if none exists
    if (body.is_active && !doc.is_active) {
      const runs = await automationRunsCol();
      const pendingExists = await runs.findOne({ automation_id: doc._id, status: "pending" });
      if (!pendingExists) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(doc.post_hour, 0, 0, 0);
        await runs.insertOne({
          automation_id: doc._id!,
          user_id: doc.user_id,
          scheduled_post_at: tomorrow,
          topic: doc.topics[doc.topic_index % doc.topics.length],
          status: "pending",
          created_at: now,
          updated_at: now,
        });
      }
    }
  }
  if (body.topics !== undefined) update.topics = body.topics;
  if (body.script_type !== undefined) update.script_type = body.script_type;
  if (body.style !== undefined) update.style = body.style;
  if (body.voice !== undefined) update.voice = body.voice;
  if (body.music !== undefined) update.music = body.music;
  if (body.duration !== undefined) update.duration = body.duration;
  if (body.post_hour !== undefined) update.post_hour = body.post_hour;
  if (body.platforms !== undefined) update.platforms = body.platforms;
  if (body.visibility !== undefined) update.visibility = body.visibility;

  await col.updateOne({ _id: new ObjectId(id) }, { $set: update });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const col = await automationsCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.is_admin && !doc.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  // Delete automation + pending runs
  const runs = await automationRunsCol();
  await runs.deleteMany({ automation_id: new ObjectId(id), status: "pending" });
  await col.deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ ok: true });
}
