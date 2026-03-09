import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.SQS_JOB_QUEUE_URL!;

export async function enqueueJob(jobId: string): Promise<void> {
  if (!QUEUE_URL) throw new Error("SQS_JOB_QUEUE_URL env var is not set");

  await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ job_id: jobId }),
      // Deduplication not needed — SQS standard queue, not FIFO
    })
  );
}
