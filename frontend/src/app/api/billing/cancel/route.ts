import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { usersCol } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cancel at Razorpay if there's an active subscription
  if (user.payment_subscription_id) {
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (keyId && keySecret) {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        await fetch(
          `https://api.razorpay.com/v1/subscriptions/${user.payment_subscription_id}/cancel`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
            body: JSON.stringify({ cancel_at_cycle_end: 0 }),
          }
        );
      }
    } catch (e) {
      console.error("[billing/cancel] Razorpay cancellation failed:", e);
      // Still downgrade locally even if Razorpay call fails
    }
  }

  const users = await usersCol();
  await users.updateOne(
    { _id: user._id },
    {
      $set: { plan: "free" },
      $unset: { payment_subscription_id: "", subscription_expires_at: "" },
    }
  );

  return NextResponse.json({ status: "cancelled", plan: "free" });
}
