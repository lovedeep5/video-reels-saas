import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "./auth-helpers";
import type { DbUser } from "./mongodb";

/** Returns the admin user or a 403 NextResponse. Use in every /api/admin/* route. */
export async function requireAdmin(
  req: NextRequest
): Promise<DbUser | NextResponse> {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return user;
}
