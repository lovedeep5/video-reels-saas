import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getChannelInfo } from "@/lib/youtube";
import { usersCol, ObjectId, MAX_CHANNELS, getChannels } from "@/lib/mongodb";

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
    const user = await users.findOne({ _id: new ObjectId(state) });
    if (!user) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=error`);
    }

    const channels = getChannels(user);

    // Check if this channel is already connected
    const existing = channels.find(
      (c) => c.platform === "youtube" && c.platform_account_id === channelInfo.channel_id
    );
    if (existing) {
      if (existing.id === "legacy_yt") {
        // Legacy channel only exists virtually — update legacy fields and persist to array
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              youtube_refresh_token: tokens.refresh_token,
              "youtube_channel.channel_title": channelInfo.channel_title,
            },
          }
        );
        // Also add to connected_channels array if not there yet
        const hasInArray = (user.connected_channels ?? []).some((c) => c.platform === "youtube" && c.platform_account_id === channelInfo.channel_id);
        if (!hasInArray) {
          await users.updateOne(
            { _id: user._id },
            {
              $push: {
                connected_channels: {
                  id: new ObjectId().toHexString(),
                  platform: "youtube" as const,
                  platform_account_id: channelInfo.channel_id,
                  account_name: channelInfo.channel_title,
                  refresh_token: tokens.refresh_token,
                  connected_at: user.youtube_channel?.connected_at ?? new Date(),
                },
              },
            }
          );
        }
      } else {
        // Real entry in connected_channels array — update in place
        await users.updateOne(
          { _id: user._id, "connected_channels.id": existing.id },
          {
            $set: {
              "connected_channels.$.refresh_token": tokens.refresh_token,
              "connected_channels.$.account_name": channelInfo.channel_title,
            },
          }
        );
      }
      return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=connected`);
    }

    // Check channel limit
    if (channels.length >= MAX_CHANNELS) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=limit`);
    }

    // Add new channel
    const newChannel = {
      id: new ObjectId().toHexString(),
      platform: "youtube" as const,
      platform_account_id: channelInfo.channel_id,
      account_name: channelInfo.channel_title,
      refresh_token: tokens.refresh_token,
      connected_at: new Date(),
    };

    await users.updateOne(
      { _id: user._id },
      { $push: { connected_channels: newChannel } }
    );

    // Also set legacy fields for backward compat (first YouTube connection)
    if (!user.youtube_channel) {
      await users.updateOne(
        { _id: user._id },
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
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=connected`);
  } catch (e) {
    console.error("[youtube/callback] error:", e);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=error`);
  }
}
