import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { usersCol, ObjectId } from "@/lib/mongodb";

const VALID_PLANS = ["free", "creator", "pro", "business"] as const;
type ValidPlan = (typeof VALID_PLANS)[number];

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

  const body = await req.json();
  const { plan } = body;

  if (!plan || !VALID_PLANS.includes(plan as ValidPlan)) {
    return NextResponse.json(
      { error: "plan must be one of: free, pro, business" },
      { status: 400 }
    );
  }

  const users = await usersCol();
  const result = await users.updateOne(
    { _id: oid },
    { $set: { plan: plan as ValidPlan } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ updated: true, plan });
}
