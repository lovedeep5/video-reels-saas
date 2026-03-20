import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { scheduledPublishesCol, ObjectId } from "@/lib/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const col = await scheduledPublishesCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.is_admin && !doc.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  return NextResponse.json({
    id: doc._id!.toHexString(),
    job_id: doc.job_id.toHexString(),
    clip_index: doc.clip_index,
    platform: doc.platform,
    channel_id: doc.channel_id,
    title: doc.title ?? null,
    description: doc.description ?? null,
    tags: doc.tags ?? [],
    visibility: doc.visibility ?? null,
    scheduled_at: doc.scheduled_at.toISOString(),
    status: doc.status,
    error_message: doc.error_message ?? null,
    published_url: doc.published_url ?? null,
    platform_id: doc.platform_id ?? null,
    published_at: doc.published_at?.toISOString() ?? null,
    created_at: doc.created_at.toISOString(),
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

  const col = await scheduledPublishesCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.is_admin && !doc.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }
  if (doc.status !== "scheduled") {
    return NextResponse.json({ error: "Can only update scheduled (not yet published) entries" }, { status: 400 });
  }

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { updated_at: new Date() };

  if (body.scheduled_at) {
    const d = new Date(body.scheduled_at);
    if (isNaN(d.getTime()) || d.getTime() < Date.now() + 60_000) {
      return NextResponse.json({ error: "scheduled_at must be at least 1 minute in the future" }, { status: 400 });
    }
    update.scheduled_at = d;
  }
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.tags !== undefined) update.tags = body.tags;
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

  const col = await scheduledPublishesCol();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.is_admin && !doc.user_id.equals(user._id!)) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }
  if (doc.status !== "scheduled") {
    return NextResponse.json({ error: "Can only cancel scheduled entries" }, { status: 400 });
  }

  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "cancelled", updated_at: new Date() } }
  );
  return NextResponse.json({ ok: true });
}
