import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getChannels } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
  const allChannels = getChannels(user);
  const igChannels = allChannels.filter((c) => c.platform === "instagram");

  return NextResponse.json({
    configured,
    connected: igChannels.length > 0,
    channels: igChannels.map((c) => ({
      id: c.id,
      platform_account_id: c.platform_account_id,
      account_name: c.account_name,
      connected_at: c.connected_at,
    })),
    // Legacy single-account compat
    account: igChannels.length > 0
      ? {
          ig_user_id: igChannels[0].platform_account_id,
          username: igChannels[0].account_name,
          connected_at: igChannels[0].connected_at,
        }
      : null,
  });
}
