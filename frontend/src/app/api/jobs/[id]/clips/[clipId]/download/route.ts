import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, clipId } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const clipIndex = parseInt(clipId, 10);
  const s3Key = job.output_clips?.[clipIndex];
  if (!s3Key) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      ...(inline ? {} : { ResponseContentDisposition: `attachment; filename="reel_${id}_clip${clipIndex + 1}.mp4"` }),
    }),
    { expiresIn: 3600 }
  );

  // Return JSON instead of redirect — direct browser redirect to S3 avoids
  // CORS errors that occur when fetch() follows a cross-origin redirect.
  return NextResponse.json({ url });
}
