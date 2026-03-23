import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth-helpers";
import { oauthStatesCol } from "@/lib/mongodb";

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
].join(",");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) {
    return NextResponse.json({ error: "Instagram integration not configured" }, { status: 503 });
  }

  if (user.plan === "free" && !user.is_admin) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?instagram=upgrade_required", req.url)
    );
  }

  // Generate cryptographic random state for CSRF protection
  const state = randomBytes(32).toString("hex");
  const states = await oauthStatesCol();
  await states.insertOne({ state, user_id: user._id!, created_at: new Date() });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/instagram/callback`;

  // Instagram Login flow (2025+) — uses api.instagram.com, NOT facebook.com
  const oauthUrl = new URL("https://www.instagram.com/oauth/authorize");
  oauthUrl.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID.trim());
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("scope", SCOPES);
  oauthUrl.searchParams.set("state", state);
  oauthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(oauthUrl.toString());
}
