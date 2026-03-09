import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "YouTube integration not configured" }, { status: 503 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL!.trim()}/api/youtube/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload",
    access_type: "offline",
    prompt: "consent",
    state: user._id!.toHexString(), // pass user ID as state for callback
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
