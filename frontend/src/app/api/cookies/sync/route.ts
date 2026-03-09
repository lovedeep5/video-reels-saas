import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });

// Allow Chrome extension origins (credentials: include requires explicit origin)
function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    origin.startsWith("chrome-extension://") ||
    origin === "https://vidtoreels.com" ||
    origin === "http://localhost:3000";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  expirationDate?: number;
}

function toNetscape(cookies: ChromeCookie[]): string {
  const lines = [
    "# Netscape HTTP Cookie File",
    "# Synced from VidToReels Chrome Extension",
    "",
  ];
  for (const c of cookies) {
    const domain = c.domain.startsWith(".") ? c.domain : `.${c.domain}`;
    const includeSubdomains = "TRUE";
    const path = c.path || "/";
    const secure = c.secure ? "TRUE" : "FALSE";
    const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 2147483647;
    lines.push(`${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiry}\t${c.name}\t${c.value}`);
  }
  return lines.join("\n") + "\n";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(req) });
  }

  let body: { cookies: ChromeCookie[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(req) });
  }

  const cookies = body.cookies;
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return NextResponse.json({ error: "No cookies provided" }, { status: 400, headers: corsHeaders(req) });
  }

  // Keep YouTube + Google account cookies — yt-dlp needs both to authenticate
  const ytCookies = cookies.filter((c) => {
    const d = c.domain ?? "";
    return d.includes("youtube.com") || d.includes("google.com");
  });
  if (ytCookies.length === 0) {
    return NextResponse.json(
      { error: "No YouTube/Google cookies found. Make sure you are logged into YouTube." },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  // Verify there are actual YouTube cookies (not just Google ones)
  const hasYT = ytCookies.some((c) => (c.domain ?? "").includes("youtube.com"));
  if (!hasYT) {
    return NextResponse.json(
      { error: "No YouTube cookies found. Make sure you are logged into YouTube in Chrome." },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  const netscape = toNetscape(ytCookies);
  const userId = user._id!.toHexString();
  const s3Key = `users/${userId}/youtube_cookies.txt`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      Body: netscape,
      ContentType: "text/plain",
    })
  );

  return NextResponse.json(
    {
      message: "YouTube cookies synced successfully",
      cookie_count: ytCookies.length,
      synced_at: new Date().toISOString(),
    },
    { headers: corsHeaders(req) }
  );
}
