import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);

  if (!user.youtube_refresh_token) {
    return NextResponse.json({ connected: false, configured });
  }

  return NextResponse.json({
    connected: true,
    configured,
    channel: user.youtube_channel ?? null,
  });
}
