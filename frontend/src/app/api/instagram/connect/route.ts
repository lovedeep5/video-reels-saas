import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.json({ error: "Instagram integration not configured" }, { status: 503 });
  }

  if (user.plan === "free" && !user.is_admin) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?instagram=upgrade_required", req.url)
    );
  }

  const state = user._id!.toHexString();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/instagram/callback`;

  const oauthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", process.env.META_APP_ID);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("scope", SCOPES);
  oauthUrl.searchParams.set("state", state);
  oauthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(oauthUrl.toString());
}
