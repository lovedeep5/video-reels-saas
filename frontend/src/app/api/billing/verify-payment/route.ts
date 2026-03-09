import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getCurrentUser } from "@/lib/auth-helpers";
import { usersCol, paymentEventsCol } from "@/lib/mongodb";
import { PLANS, PlanKey } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_key } = await req.json();

  if (!plan_key || !(plan_key in PLANS)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  // Verify Razorpay signature
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Payment verification failed — invalid signature" }, { status: 400 });
  }

  // Activate plan
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const users = await usersCol();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        plan: plan_key as PlanKey,
        payment_subscription_id: razorpay_payment_id,
        payment_provider: "razorpay",
        subscription_expires_at: expiresAt,
      },
    }
  );

  // Log event
  const events = await paymentEventsCol();
  await events.insertOne({
    user_id: user._id,
    provider: "razorpay",
    event_type: "payment.captured",
    payload: JSON.stringify({ razorpay_order_id, razorpay_payment_id, plan_key }),
    processed: true,
    created_at: new Date(),
  });

  return NextResponse.json({ status: "active", plan: plan_key });
}
