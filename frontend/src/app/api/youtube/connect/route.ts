import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth-helpers";
import { oauthStatesCol } from "@/lib/mongodb";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const PAID_PLANS = ["pro", "business"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.is_admin && !PAID_PLANS.includes(user.plan)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    return NextResponse.redirect(`${appUrl}/dashboard/settings?youtube=upgrade_required`);
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "YouTube integration not configured" }, { status: 503 });
  }

  // Generate cryptographic random state for CSRF protection
  const state = randomBytes(32).toString("hex");
  const states = await oauthStatesCol();
  await states.insertOne({ state, user_id: user._id!, created_at: new Date() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/youtube/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
