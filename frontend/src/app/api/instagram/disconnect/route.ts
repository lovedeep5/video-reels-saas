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
    // Remove specific channel from array
    await users.updateOne(
      { _id: user._id },
      { $pull: { connected_channels: { id: channelId } } }
    );
    // If removing legacy channel, also clear legacy fields
    if (channelId === "legacy_ig") {
      await users.updateOne(
        { _id: user._id },
        { $unset: { instagram_access_token: "", instagram_token_updated_at: "", instagram_account: "" } }
      );
    }
  } else {
    // Legacy: remove all Instagram (clear legacy fields + all IG from array)
    await users.updateOne(
      { _id: user._id },
      {
        $unset: { instagram_access_token: "", instagram_token_updated_at: "", instagram_account: "" },
        $pull: { connected_channels: { platform: "instagram" } },
      }
    );
  }

  return NextResponse.json({ message: "Disconnected" });
}
