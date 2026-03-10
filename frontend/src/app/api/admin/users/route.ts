import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { jobsCol, usersCol } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const [users, jobs] = await Promise.all([usersCol(), jobsCol()]);

  const allUsers = await users.find({}).toArray();

  const userList = await Promise.all(
    allUsers.map(async (user) => {
      const job_count = await jobs.countDocuments({ user_id: user._id });
      return {
        id: user._id!.toString(),
        name: user.name,
        email: user.email,
        plan: user.plan,
        is_admin: user.is_admin ?? false,
        is_active: user.is_active,
        created_at: user.created_at,
        job_count,
      };
    })
  );

  return NextResponse.json(userList);
}
