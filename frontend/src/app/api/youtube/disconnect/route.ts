import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { usersCol, getChannels } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const channelId: string | undefined = body.channel_id;

  const users = await usersCol();

  if (channelId) {
    // Find the channel being disconnected to check if it matches legacy account
    const channels = getChannels(user);
    const channel = channels.find((c) => c.id === channelId);

    await users.updateOne(
      { _id: user._id },
      { $pull: { connected_channels: { id: channelId } } }
    );
    // Clear legacy fields if this channel matches the legacy YouTube account
    if (
      channelId === "legacy_yt" ||
      (channel && user.youtube_channel && channel.platform_account_id === user.youtube_channel.channel_id)
    ) {
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
