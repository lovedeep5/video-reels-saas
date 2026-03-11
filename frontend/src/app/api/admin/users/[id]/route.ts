import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { jobsCol, usersCol, ObjectId } from "@/lib/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await params;

  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const [users, jobs] = await Promise.all([usersCol(), jobsCol()]);

  const user = await users.findOne({ _id: oid });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userJobs = await jobs.find({ user_id: oid }).sort({ created_at: -1 }).toArray();

  const jobList = userJobs.map((job) => ({
    id: job._id!.toString(),
    status: job.status,
    source_url: job.source_url,
    video_title: job.video_title,
    created_at: job.created_at,
    clip_count: (job.output_clips ?? []).length,
    output_clips: job.output_clips ?? [],
    output_ratio: job.output_ratio,
  }));

  return NextResponse.json({
    id: user._id!.toString(),
    name: user.name,
    email: user.email,
    plan: user.plan,
    is_admin: user.is_admin ?? false,
    is_active: user.is_active,
    created_at: user.created_at,
    jobs: jobList,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await params;

  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const [users, jobs] = await Promise.all([usersCol(), jobsCol()]);

  const user = await users.findOne({ _id: oid });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await jobs.deleteMany({ user_id: oid });
  await users.deleteOne({ _id: oid });

  return NextResponse.json({ deleted: true });
}
