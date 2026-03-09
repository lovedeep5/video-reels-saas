import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol } from "@/lib/mongodb";
import { getPlan, BILLABLE_STATUSES } from "@/lib/plans";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = getPlan(user.plan);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const jobs = await jobsCol();
  const used = await jobs.countDocuments({
    user_id: user._id,
    created_at: { $gte: startOfMonth },
    status: { $in: [...BILLABLE_STATUSES] },
  });

  return NextResponse.json({
    videos_used: used,
    videos_limit: plan.videos_per_month,
    clips_per_video: plan.clips_per_video,
    plan: user.plan,
  });
}
