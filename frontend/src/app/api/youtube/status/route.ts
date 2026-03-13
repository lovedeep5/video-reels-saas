import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getChannels } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
  const allChannels = getChannels(user);
  const ytChannels = allChannels.filter((c) => c.platform === "youtube");

  return NextResponse.json({
    connected: ytChannels.length > 0,
    configured,
    channels: ytChannels.map((c) => ({
      id: c.id,
      platform_account_id: c.platform_account_id,
      account_name: c.account_name,
      connected_at: c.connected_at,
    })),
    // Legacy single-channel compat
    channel: ytChannels.length > 0
      ? {
          channel_id: ytChannels[0].platform_account_id,
          channel_title: ytChannels[0].account_name,
          connected_at: ytChannels[0].connected_at,
        }
      : null,
  });
}
