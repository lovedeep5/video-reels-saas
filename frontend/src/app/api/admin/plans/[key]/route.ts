import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { plansCol, usersCol } from "@/lib/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { key } = await params;
  const col = await plansCol();
  const plan = await col.findOne({ key });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json(plan);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { key } = await params;
  const col = await plansCol();

  const existing = await col.findOne({ key });
  if (!existing) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    name,
    price,
    currency,
    clips_per_video,
    videos_per_month,
    max_duration_seconds,
    auto_publish,
    scheduled_publish,
    features,
    is_active,
  } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date() };

  if (name !== undefined) updates.name = name;
  if (currency !== undefined) updates.currency = currency;
  if (clips_per_video !== undefined) updates.clips_per_video = clips_per_video;
  if (videos_per_month !== undefined) updates.videos_per_month = videos_per_month;
  if (max_duration_seconds !== undefined) updates.max_duration_seconds = max_duration_seconds;
  if (auto_publish !== undefined) updates.auto_publish = auto_publish;
  if (scheduled_publish !== undefined) updates.scheduled_publish = scheduled_publish;
  if (features !== undefined) updates.features = features;
  if (is_active !== undefined) updates.is_active = is_active;

  // If price changed and there is an active Razorpay plan, archive it
  if (price !== undefined && price !== existing.price) {
    updates.price = price;
    if (existing.razorpay_plan_id) {
      const historyEntry = {
        plan_id: existing.razorpay_plan_id,
        price: existing.price,
        archived_at: new Date(),
      };
      await col.updateOne(
        { key },
        {
          $set: updates,
          $unset: { razorpay_plan_id: "" },
          $push: { razorpay_plan_history: historyEntry },
        }
      );
      const updated = await col.findOne({ key });
      return NextResponse.json(updated);
    }
  }

  await col.updateOne({ key }, { $set: updates });
  const updated = await col.findOne({ key });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { key } = await params;

  const [col, users] = await Promise.all([plansCol(), usersCol()]);

  const plan = await col.findOne({ key });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const userCount = await users.countDocuments({ plan: key as "free" | "creator" | "pro" | "business" });
  if (userCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete plan: ${userCount} user(s) are on this plan`, user_count: userCount },
      { status: 400 }
    );
  }

  await col.deleteOne({ key });
  return NextResponse.json({ deleted: true });
}
