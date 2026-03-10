import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { usersCol, ObjectId } from "@/lib/mongodb";

export async function PATCH(
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

  // Prevent demoting yourself
  if (adminOrRes._id!.toString() === oid.toString()) {
    return NextResponse.json(
      { error: "Cannot change your own admin status" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { is_admin } = body;

  if (typeof is_admin !== "boolean") {
    return NextResponse.json({ error: "is_admin must be a boolean" }, { status: 400 });
  }

  const users = await usersCol();
  const result = await users.updateOne({ _id: oid }, { $set: { is_admin } });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ updated: true, is_admin });
}
