import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, serializeId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...rest } = serializeId(user);
  return NextResponse.json({ id, name: rest.name, email: rest.email, plan: rest.plan, is_admin: rest.is_admin ?? false });
}
