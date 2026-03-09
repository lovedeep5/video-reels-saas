import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s3Key = `users/${user._id!.toHexString()}/youtube_cookies.txt`;

  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: s3Key })
    );
    return NextResponse.json({
      synced: true,
      last_modified: head.LastModified?.toISOString() ?? null,
      size_bytes: head.ContentLength ?? 0,
    });
  } catch {
    // HeadObject throws if key doesn't exist
    return NextResponse.json({ synced: false });
  }
}
