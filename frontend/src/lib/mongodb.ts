import { MongoClient, Db, ObjectId, Collection } from "mongodb";

const URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB_NAME || "vidtoreels";

if (!URI) throw new Error("MONGODB_URI env var is not set");

// Module-level cache so the connection is reused across hot reloads in dev
// and across invocations within the same Lambda/Vercel function instance.
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(URI);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(URI);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const c = await clientPromise;
  return c.db(DB_NAME);
}

// ── Collection types ──────────────────────────────────────────────────────────

export interface DbUser {
  _id?: ObjectId;
  clerk_id: string;
  email: string;
  name: string;
  plan: "free" | "pro" | "business";
  payment_customer_id?: string;
  payment_subscription_id?: string;
  payment_provider?: string;
  subscription_expires_at?: Date;
  is_active: boolean;
  is_admin?: boolean;
  created_at: Date;
  // YouTube OAuth (optional — only set when user connects their channel)
  youtube_refresh_token?: string;
  youtube_channel?: {
    channel_id: string;
    channel_title: string;
    connected_at: Date;
  };
  // Instagram OAuth (optional — long-lived token, 60 days)
  instagram_access_token?: string;
  instagram_token_updated_at?: Date;
  instagram_account?: {
    ig_user_id: string;
    username: string;
    connected_at: Date;
  };
}

export interface DbJob {
  _id?: ObjectId;
  user_id: ObjectId;
  status: "queued" | "starting" | "downloading" | "processing" | "rendering" | "completed" | "failed";
  source_type: "url" | "upload" | "faceless";
  source_url?: string;
  source_filename?: string;
  video_title?: string;
  video_duration?: number;
  clips_requested: number;
  output_ratio: string;
  include_captions?: boolean;
  progress: number;
  progress_message: string;
  output_clips?: string[];   // S3 keys
  admin_retry_user_id?: string;
  error_message?: string;
  retry_count: number;
  ec2_instance_id?: string;
  // Faceless video fields
  faceless_topic?: string;
  faceless_style?: string;
  faceless_voice?: string;
  faceless_duration?: number;
  faceless_music?: string;
  faceless_text_style?: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

export interface DbApiKey {
  _id?: ObjectId;
  user_id: ObjectId;
  name: string;
  key_prefix: string;
  key_hash: string;
  is_active: boolean;
  expires_at?: Date;
  last_used_at?: Date;
  created_at: Date;
}

export interface DbPaymentEvent {
  _id?: ObjectId;
  user_id?: ObjectId;
  provider: string;
  event_type: string;
  payload: string;
  processed: boolean;
  created_at: Date;
}

let _indexesEnsured = false;

export async function usersCol(): Promise<Collection<DbUser>> {
  const col = (await getDb()).collection<DbUser>("users");
  if (!_indexesEnsured) {
    _indexesEnsured = true;
    // Unique index prevents duplicate users from race conditions
    col.createIndex({ clerk_id: 1 }, { unique: true, sparse: true }).catch(() => {});
  }
  return col;
}

export async function jobsCol(): Promise<Collection<DbJob>> {
  return (await getDb()).collection<DbJob>("jobs");
}

export async function apiKeysCol(): Promise<Collection<DbApiKey>> {
  return (await getDb()).collection<DbApiKey>("api_keys");
}

export async function paymentEventsCol(): Promise<Collection<DbPaymentEvent>> {
  return (await getDb()).collection<DbPaymentEvent>("payment_events");
}

export interface DbPlan {
  _id?: ObjectId;
  key: string;
  name: string;
  price: number;
  currency: string;
  clips_per_video: number;
  videos_per_month: number;
  max_duration_seconds: number;
  auto_publish: boolean;
  scheduled_publish: boolean;
  features: string[];
  is_active: boolean;
  razorpay_plan_id: string | null;
  razorpay_plan_history?: { plan_id: string; price: number; archived_at: Date }[];
  created_at: Date;
  updated_at: Date;
}

export async function plansCol(): Promise<Collection<DbPlan>> {
  return (await getDb()).collection<DbPlan>("plans");
}

export { ObjectId };
