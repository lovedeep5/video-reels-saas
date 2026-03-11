import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { refreshAccessToken, uploadVideoToYouTube } from "@/lib/youtube";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const PAID_PLANS = ["pro", "business"];
  if (!user.is_admin && !PAID_PLANS.includes(user.plan)) {
    return NextResponse.json({ error: "YouTube publishing is available on Pro and Business plans" }, { status: 403 });
  }

  if (!user.youtube_refresh_token) {
    return NextResponse.json({ error: "YouTube not connected" }, { status: 400 });
  }

  const { id, clipId } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: new ObjectId(id), user_id: user._id });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "completed") {
    return NextResponse.json({ error: "Job is not completed yet" }, { status: 400 });
  }

  const clipIndex = parseInt(clipId, 10);
  if (isNaN(clipIndex) || clipIndex < 0 || clipIndex >= (job.output_clips?.length ?? 0)) {
    return NextResponse.json({ error: "Invalid clip" }, { status: 400 });
  }

  const s3Key = job.output_clips![clipIndex];
  const body = await req.json();
  const title: string = (body.title ?? `Clip ${clipIndex + 1}`).slice(0, 100);
  const description: string = (body.description ?? "").slice(0, 5000);
  const tags: string[] = (Array.isArray(body.tags) ? body.tags : []).map(String).slice(0, 15);
  const visibility: "public" | "unlisted" | "private" = ["public", "unlisted", "private"].includes(body.visibility)
    ? body.visibility
    : "private";

  // Validate publishAt if provided — must be a valid date at least 5 min in the future
  let publishAt: string | undefined;
  if (body.publishAt) {
    const scheduledDate = new Date(body.publishAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid publishAt date" }, { status: 400 });
    }
    if (scheduledDate.getTime() < Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({ error: "Scheduled time must be at least 5 minutes in the future" }, { status: 400 });
    }
    publishAt = scheduledDate.toISOString();
  }

  try {
    // Refresh access token
    const accessToken = await refreshAccessToken(user.youtube_refresh_token);

    // Download clip from S3
    const s3Res = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: s3Key })
    );
    const videoBuffer = await streamToBuffer(s3Res.Body as Readable);

    // Upload to YouTube
    const videoId = await uploadVideoToYouTube(accessToken, {
      title,
      description: description + (tags.length ? `\n\n${tags.map((t) => `#${t}`).join(" ")}` : ""),
      visibility,
      videoBuffer,
      tags,
      publishAt,
    });

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Persist published info to clip metadata so the UI can show the link
    const updateKey = `output_clip_metadata.${clipIndex}.youtube_video_id`;
    const updateUrl = `output_clip_metadata.${clipIndex}.youtube_url`;
    const updateScheduled = `output_clip_metadata.${clipIndex}.youtube_scheduled_at`;
    await jobs.updateOne(
      { _id: new ObjectId(id) },
      { $set: {
        [updateKey]: videoId,
        [updateUrl]: youtubeUrl,
        ...(publishAt ? { [updateScheduled]: publishAt } : {}),
      }}
    );

    return NextResponse.json({
      youtube_video_id: videoId,
      youtube_url: youtubeUrl,
    });
  } catch (e: unknown) {
    console.error("[publish-youtube] error:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Upload failed" },
      { status: 500 }
    );
  }
}
