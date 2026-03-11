import { NextRequest, NextResponse } from "next/server";
import { usersCol, ObjectId } from "@/lib/mongodb";
import { exchangeCodeForLongLivedToken, getInstagramAccount } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!.trim();

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=denied`);
  }

  if (!ObjectId.isValid(state)) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=error`);
  }

  try {
    const longLivedToken = await exchangeCodeForLongLivedToken(code);
    const account = await getInstagramAccount(longLivedToken);

    const users = await usersCol();
    await users.updateOne(
      { _id: new ObjectId(state) },
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

    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=connected`);
  } catch (e) {
    console.error("[instagram/callback] error:", e);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?instagram=error`);
  }
}
