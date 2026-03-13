import { NextRequest, NextResponse } from "next/server";
import { usersCol, ObjectId, MAX_CHANNELS, getChannels } from "@/lib/mongodb";
import { exchangeCodeForLongLivedToken, getInstagramAccount } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!.trim();

  if (error || !code || !state) {
    console.error("[instagram/callback] OAuth error:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=denied`);
  }

  if (!ObjectId.isValid(state)) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=error`);
  }

  try {
    const longLivedToken = await exchangeCodeForLongLivedToken(code);
    const account = await getInstagramAccount(longLivedToken);

    const users = await usersCol();
    const user = await users.findOne({ _id: new ObjectId(state) });
    if (!user) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=error`);
    }

    const channels = getChannels(user);

    // Check if this account is already connected
    const existing = channels.find(
      (c) => c.platform === "instagram" && c.platform_account_id === account.ig_user_id
    );
    if (existing) {
      // Update token for existing channel
      await users.updateOne(
        { _id: user._id, "connected_channels.id": existing.id },
        {
          $set: {
            "connected_channels.$.access_token": longLivedToken,
            "connected_channels.$.token_updated_at": new Date(),
            "connected_channels.$.account_name": account.username,
          },
        }
      );
      // Also update legacy fields if this is the legacy channel
      if (existing.id === "legacy_ig") {
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              instagram_access_token: longLivedToken,
              instagram_token_updated_at: new Date(),
              "instagram_account.username": account.username,
            },
          }
        );
      }
      return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=connected`);
    }

    // Check channel limit
    if (channels.length >= MAX_CHANNELS) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=limit`);
    }

    // Add new channel
    const newChannel = {
      id: new ObjectId().toHexString(),
      platform: "instagram" as const,
      platform_account_id: account.ig_user_id,
      account_name: account.username,
      access_token: longLivedToken,
      token_updated_at: new Date(),
      connected_at: new Date(),
    };

    await users.updateOne(
      { _id: user._id },
      { $push: { connected_channels: newChannel } }
    );

    // Also set legacy fields for backward compat (first Instagram connection)
    if (!user.instagram_account) {
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            instagram_access_token: longLivedToken,
            instagram_token_updated_at: new Date(),
            instagram_account: {
              ig_user_id: account.ig_user_id,
              username: account.username,
              connected_at: new Date(),
            },
          },
        }
      );
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=connected`);
  } catch (e) {
    console.error("[instagram/callback] error:", e);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=error`);
  }
}
