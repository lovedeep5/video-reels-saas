import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  const connected = !!user.instagram_account?.ig_user_id;

  return NextResponse.json({
    configured,
    connected,
    account: connected
      ? {
          ig_user_id: user.instagram_account!.ig_user_id,
          username: user.instagram_account!.username,
          connected_at: user.instagram_account!.connected_at,
        }
      : null,
  });
}
