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

// DELETE /api/admin/users — deduplicate users (remove race-condition duplicates)
export async function DELETE(req: NextRequest) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const users = await usersCol();

  const dupes = await users
    .aggregate<{ _id: string; count: number; docs: { id: any; created_at: Date }[] }>([
      {
        $group: {
          _id: "$clerk_id",
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", created_at: "$created_at" } },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  let removed = 0;
  for (const group of dupes) {
    const sorted = group.docs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    // Keep the oldest, delete the rest
    for (let i = 1; i < sorted.length; i++) {
      await users.deleteOne({ _id: sorted[i].id });
      removed++;
    }
  }

  return NextResponse.json({
    duplicated_clerk_ids: dupes.length,
    removed_documents: removed,
  });
}
