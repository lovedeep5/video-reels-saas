import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiKeysCol, ObjectId } from "@/lib/mongodb";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid key id" }, { status: 400 });

  const keys = await apiKeysCol();
  const key = await keys.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!key) return NextResponse.json({ error: "API key not found" }, { status: 404 });

  await keys.updateOne({ _id: new ObjectId(id) }, { $set: { is_active: false } });
  return NextResponse.json({ message: "API key revoked" });
}
