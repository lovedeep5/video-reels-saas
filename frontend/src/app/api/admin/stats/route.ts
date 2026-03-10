import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { jobsCol, usersCol } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const [jobs, users] = await Promise.all([jobsCol(), usersCol()]);

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    total_users,
    admin_users,
    jobs_today,
    jobs_week,
    jobs_total,
    jobsByStatusRaw,
    planBreakdownRaw,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ is_admin: true }),
    jobs.countDocuments({ created_at: { $gte: startOfToday } }),
    jobs.countDocuments({ created_at: { $gte: startOfWeek } }),
    jobs.countDocuments(),
    jobs
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray(),
    users
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const jobs_by_status: Record<string, number> = {};
  for (const row of jobsByStatusRaw) {
    jobs_by_status[row._id] = row.count;
  }

  const plan_breakdown: Record<string, number> = {};
  for (const row of planBreakdownRaw) {
    plan_breakdown[row._id] = row.count;
  }

  return NextResponse.json({
    total_users,
    admin_users,
    jobs_today,
    jobs_week,
    jobs_total,
    jobs_by_status,
    plan_breakdown,
  });
}
