import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol } from "@/lib/mongodb";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s3Key = `users/${user._id!.toHexString()}/youtube_cookies.txt`;

  // Fetch cookie sync time and last job time in parallel
  const [cookieResult, lastJob] = await Promise.all([
    s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: s3Key })).catch(() => null),
    jobsCol().then((col) =>
      col.findOne(
        { user_id: user._id, source_type: "url" },
        { sort: { created_at: -1 }, projection: { created_at: 1 } }
      )
    ),
  ]);

  if (!cookieResult) {
    return NextResponse.json({ synced: false });
  }

  const cookieSyncedAt = cookieResult.LastModified ?? null;
  const lastJobAt = lastJob?.created_at ?? null;

  // Cookies need refresh if a job was submitted AFTER the last sync
  const needs_refresh = !!(
    cookieSyncedAt &&
    lastJobAt &&
    lastJobAt > cookieSyncedAt
  );

  return NextResponse.json({
    synced: true,
    needs_refresh,
    last_modified: cookieSyncedAt?.toISOString() ?? null,
    last_job_at: lastJobAt?.toISOString() ?? null,
  });
}
