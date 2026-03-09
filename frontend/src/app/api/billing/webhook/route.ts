import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { usersCol, paymentEventsCol } from "@/lib/mongodb";
import { PLANS, PlanKey } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // Verify webhook signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret) {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    if (expected !== signature) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }
  }

  let payload: any;
  let eventType = "unknown";
  try {
    payload = JSON.parse(body);
    eventType = payload.event ?? "unknown";
  } catch {
    payload = {};
  }

  // Log event
  const events = await paymentEventsCol();
  const eventDoc = await events.insertOne({
    provider: "razorpay",
    event_type: eventType,
    payload: body,
    processed: false,
    created_at: new Date(),
  });

  // Handle payment captured
  if (eventType === "payment.captured") {
    try {
      const notes = payload?.payload?.payment?.entity?.notes ?? {};
      const plan_key = notes.plan_key as PlanKey;
      const userId = notes.user_id;

      if (plan_key && userId && plan_key in PLANS) {
        const { ObjectId } = await import("mongodb");
        const users = await usersCol();
        await users.updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              plan: plan_key,
              subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          }
        );
        await events.updateOne({ _id: eventDoc.insertedId }, { $set: { processed: true } });
      }
    } catch (e) {
      console.error("[webhook] payment.captured handler error:", e);
    }
  }

  return NextResponse.json({ status: "received" });
}
