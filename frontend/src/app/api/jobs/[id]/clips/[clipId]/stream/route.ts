import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

export const runtime = "nodejs";

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
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, clipId } = await params;
  if (!ObjectId.isValid(id)) return new NextResponse("Invalid job id", { status: 400 });

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!job) return new NextResponse("Not found", { status: 404 });

  const clipIndex = parseInt(clipId, 10);
  const s3Key = job.output_clips?.[clipIndex];
  if (!s3Key) return new NextResponse("Clip not found", { status: 404 });

  const range = req.headers.get("range") ?? undefined;

  const s3Res = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      ...(range ? { Range: range } : {}),
    })
  );

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (s3Res.ContentLength != null) headers["Content-Length"] = String(s3Res.ContentLength);
  if (s3Res.ContentRange) headers["Content-Range"] = s3Res.ContentRange;

  const webStream = Readable.toWeb(s3Res.Body as Readable) as ReadableStream;

  return new NextResponse(webStream, {
    status: range ? 206 : 200,
    headers,
  });
}
