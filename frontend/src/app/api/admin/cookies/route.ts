import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// S3 key is per-user — resolved after auth

export async function POST(req: NextRequest) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;
  const user = adminOrRes;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("cookies") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided (field name: cookies)" }, { status: 400 });

  // Only accept .txt files
  if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
    return NextResponse.json({ error: "File must be a .txt file" }, { status: 400 });
  }

  // 5MB sanity limit
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const content = await file.text();

  // Validate Netscape cookie format
  if (!content.includes("# Netscape HTTP Cookie File")) {
    return NextResponse.json({
      error: "Invalid file format. Must be a Netscape HTTP Cookie File exported via the 'Get cookies.txt LOCALLY' browser extension.",
    }, { status: 400 });
  }

  // Count cookie lines by domain
  const cookieLines = content.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  const youtubeCookies = cookieLines.filter(l => l.includes("youtube.com"));
  const googleCookies  = cookieLines.filter(l => l.includes("google.com"));

  if (youtubeCookies.length === 0) {
    return NextResponse.json({
      error: "No YouTube cookies found. Export cookies while logged in to youtube.com.",
    }, { status: 400 });
  }

  const s3Key = `users/${user._id!.toHexString()}/youtube_cookies.txt`;

  // Upload to S3
  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      Body: content,
      ContentType: "text/plain",
    }));
  } catch (err) {
    console.error("[cookies] S3 upload failed:", err);
    return NextResponse.json({ error: "S3 upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    message: "YouTube cookies synced successfully",
    stats: {
      total_cookie_lines: cookieLines.length,
      youtube_cookies: youtubeCookies.length,
      google_cookies: googleCookies.length,
      file_size_kb: Math.round(file.size / 1024),
      uploaded: true,
    },
  });
}
