import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { usersCol } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await usersCol();
  await users.updateOne(
    { _id: user._id },
    { $set: { plan: "free", payment_subscription_id: undefined, subscription_expires_at: undefined } }
  );

  return NextResponse.json({ status: "cancelled", plan: "free" });
}
