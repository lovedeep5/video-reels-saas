import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { plansCol, DbPlan } from "@/lib/mongodb";

const DEFAULT_PLANS: Omit<DbPlan, "_id">[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    currency: "INR",
    clips_per_video: 3,
    videos_per_month: 2,
    max_duration_seconds: 0,
    auto_publish: false,
    scheduled_publish: false,
    features: ["3 clips per video", "2 videos/month", "Download clips"],
    is_active: true,
    razorpay_plan_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    key: "pro",
    name: "Pro",
    price: 1499,
    currency: "INR",
    clips_per_video: 10,
    videos_per_month: 20,
    max_duration_seconds: 3600,
    auto_publish: false,
    scheduled_publish: true,
    features: [
      "10 clips per video",
      "20 videos/month",
      "Max 60 min video",
      "YouTube publishing",
      "Scheduled publish",
    ],
    is_active: true,
    razorpay_plan_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    key: "business",
    name: "Business",
    price: 3999,
    currency: "INR",
    clips_per_video: 20,
    videos_per_month: -1,
    max_duration_seconds: 10800,
    auto_publish: true,
    scheduled_publish: true,
    features: [
      "20 clips per video",
      "Unlimited videos",
      "Max 3 hr video",
      "Auto-publish to YouTube",
      "Priority queue",
    ],
    is_active: true,
    razorpay_plan_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

export async function GET(req: NextRequest) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const col = await plansCol();
  let plans = await col.find({}).sort({ price: 1 }).toArray();

  if (plans.length === 0) {
    await col.insertMany(DEFAULT_PLANS as DbPlan[]);
    plans = await col.find({}).sort({ price: 1 }).toArray();
  }

  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const body = await req.json();
  const {
    key,
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

  if (!key || !name) {
    return NextResponse.json({ error: "key and name are required" }, { status: 400 });
  }

  const col = await plansCol();

  const existing = await col.findOne({ key });
  if (existing) {
    return NextResponse.json({ error: "Plan key already exists" }, { status: 409 });
  }

  const now = new Date();
  const plan: Omit<DbPlan, "_id"> = {
    key,
    name,
    price: price ?? 0,
    currency: currency ?? "INR",
    clips_per_video: clips_per_video ?? 0,
    videos_per_month: videos_per_month ?? 0,
    max_duration_seconds: max_duration_seconds ?? 0,
    auto_publish: auto_publish ?? false,
    scheduled_publish: scheduled_publish ?? false,
    features: features ?? [],
    is_active: is_active ?? true,
    razorpay_plan_id: null,
    created_at: now,
    updated_at: now,
  };

  const result = await col.insertOne(plan as DbPlan);
  const created = await col.findOne({ _id: result.insertedId });

  return NextResponse.json(created, { status: 201 });
}
