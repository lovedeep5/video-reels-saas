import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    plan: user.plan,
    payment_customer_id: user.payment_customer_id ?? null,
    payment_subscription_id: user.payment_subscription_id ?? null,
    subscription_expires_at: user.subscription_expires_at?.toISOString() ?? null,
    payment_provider: user.payment_provider ?? null,
  });
}
