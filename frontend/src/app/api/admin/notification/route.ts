import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

async function settingsCol() {
  return (await getDb()).collection<{ _id: string; text: string }>("settings");
}

// Public — any authenticated user can read the banner
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const col = await settingsCol();
  const doc = await col.findOne({ _id: "notification_banner" } as any);
  return NextResponse.json({ text: doc?.text ?? "" });
}

// Admin only — update the banner text
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { text } = await req.json();
  const col = await settingsCol();
  await col.updateOne(
    { _id: "notification_banner" } as any,
    { $set: { text: String(text ?? "").trim() } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
