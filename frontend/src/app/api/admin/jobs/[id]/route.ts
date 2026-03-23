import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { jobsCol, ObjectId } from "@/lib/mongodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrRes = await requireAdmin(req);
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await params;

  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const jobs = await jobsCol();
  const job = await jobs.findOne({ _id: oid });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Clean up S3 clips before deleting job
  if (job.output_clips?.length) {
    const bucket = process.env.S3_BUCKET!;
    await Promise.all(
      job.output_clips.map((key) =>
        s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {})
      )
    );
  }

  await jobs.deleteOne({ _id: oid });
  return NextResponse.json({ deleted: true });
}
