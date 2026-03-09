import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getCurrentUser } from "@/lib/auth-helpers";
import { PLANS, PlanKey } from "@/lib/plans";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_key } = await req.json();
  if (!plan_key || !(plan_key in PLANS)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (plan_key === "free") {
    return NextResponse.json({ error: "Cannot subscribe to free plan" }, { status: 400 });
  }

  const plan = PLANS[plan_key as PlanKey];
  if (plan.price === 0) {
    return NextResponse.json({ error: "Plan has no price" }, { status: 400 });
  }

  try {
    const order = await razorpay.orders.create({
      amount: plan.price * 100, // paise
      currency: "INR",
      notes: { plan_key, user_id: user._id!.toHexString() },
    });

    return NextResponse.json({
      order_id: order.id,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      plan_key,
      plan_name: plan.name,
      prefill: { name: user.name, email: user.email },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Payment gateway error: ${e.message}` }, { status: 502 });
  }
}
