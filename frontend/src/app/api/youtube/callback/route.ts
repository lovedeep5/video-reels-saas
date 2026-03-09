import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getChannelInfo } from "@/lib/youtube";
import { usersCol, ObjectId } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // user ObjectId
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=denied`);
  }

  if (!ObjectId.isValid(state)) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const channelInfo = await getChannelInfo(tokens.access_token);

    const users = await usersCol();
    await users.updateOne(
      { _id: new ObjectId(state) },
      {
        $set: {
          youtube_refresh_token: tokens.refresh_token,
          youtube_channel: {
            channel_id: channelInfo.channel_id,
            channel_title: channelInfo.channel_title,
            connected_at: new Date(),
          },
        },
      }
    );

    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=connected`);
  } catch (e) {
    console.error("[youtube/callback] error:", e);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=error`);
  }
}
