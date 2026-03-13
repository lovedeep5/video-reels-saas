import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol, ObjectId, usersCol, getChannels } from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { refreshToken, publishReel } from "@/lib/instagram";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.plan === "free" && !user.is_admin) {
    return NextResponse.json(
      { error: "Instagram publishing requires a Pro or Business plan." },
      { status: 403 }
    );
  }

  const { id, clipId } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

  const clipIndex = parseInt(clipId, 10);
  if (isNaN(clipIndex) || clipIndex < 0) {
    return NextResponse.json({ error: "Invalid clip index" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const caption: string = (body.caption ?? "").slice(0, 2200);
  const channelId: string | undefined = body.channel_id;

  // Find the Instagram channel to publish to
  const channels = getChannels(user);
  const igChannels = channels.filter((c) => c.platform === "instagram");

  if (igChannels.length === 0) {
    return NextResponse.json(
      { error: "Instagram account not connected. Go to Settings to connect." },
      { status: 400 }
    );
  }

  // Use specified channel or first Instagram channel
  const channel = channelId
    ? igChannels.find((c) => c.id === channelId)
    : igChannels[0];

  if (!channel || !channel.access_token) {
    return NextResponse.json({ error: "Instagram channel not found" }, { status: 400 });
  }

  // Fetch job
  const jobs = await jobsCol();
  const filter = user.is_admin
    ? { _id: new ObjectId(id) }
    : { _id: new ObjectId(id), user_id: user._id };
  const job = await jobs.findOne(filter);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status !== "completed") {
    return NextResponse.json({ error: "Job is not completed yet" }, { status: 400 });
  }

  const s3Key = (job.output_clips ?? [])[clipIndex];
  if (!s3Key) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  try {
    // Refresh the token (resets 60-day window)
    const freshToken = await refreshToken(channel.access_token);

    // Persist refreshed token
    const users = await usersCol();
    if (channel.id === "legacy_ig") {
      await users.updateOne(
        { _id: user._id },
        { $set: { instagram_access_token: freshToken, instagram_token_updated_at: new Date() } }
      );
    } else {
      await users.updateOne(
        { _id: user._id, "connected_channels.id": channel.id },
        { $set: { "connected_channels.$.access_token": freshToken, "connected_channels.$.token_updated_at": new Date() } }
      );
    }

    // Generate pre-signed S3 URL (10 min)
    const videoUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: s3Key }),
      { expiresIn: 600 }
    );

    // Publish reel
    const result = await publishReel(
      freshToken,
      channel.platform_account_id,
      channel.account_name,
      videoUrl,
      caption
    );

    // Store metadata on the job
    const metaKey = `output_clip_metadata.${clipIndex}.instagram_media_id`;
    const urlKey = `output_clip_metadata.${clipIndex}.instagram_url`;
    await jobs.updateOne(
      { _id: new ObjectId(id) },
      { $set: { [metaKey]: result.instagram_media_id, [urlKey]: result.instagram_url } }
    );

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
