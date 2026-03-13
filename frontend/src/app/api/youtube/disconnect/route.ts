import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { usersCol } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const channelId: string | undefined = body.channel_id;

  const users = await usersCol();

  if (channelId) {
    await users.updateOne(
      { _id: user._id },
      { $pull: { connected_channels: { id: channelId } } }
    );
    if (channelId === "legacy_yt") {
      await users.updateOne(
        { _id: user._id },
        { $unset: { youtube_refresh_token: "", youtube_channel: "" } }
      );
    }
  } else {
    await users.updateOne(
      { _id: user._id },
      {
        $unset: { youtube_refresh_token: "", youtube_channel: "" },
        $pull: { connected_channels: { platform: "youtube" } },
      }
    );
  }

  return NextResponse.json({ message: "YouTube disconnected" });
}
