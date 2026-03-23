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

export interface ConnectedChannel {
  id: string;                       // unique ID (ObjectId hex)
  platform: "youtube" | "instagram";
  platform_account_id: string;      // YouTube channel_id or IG user_id
  account_name: string;             // channel title or @username
  access_token?: string;            // Instagram long-lived token
  refresh_token?: string;           // YouTube refresh token
  token_updated_at?: Date;
  connected_at: Date;
}

export const MAX_CHANNELS = 5;

export interface DbUser {
  _id?: ObjectId;
  clerk_id: string;
  email: string;
  name: string;
  plan: "free" | "creator" | "pro" | "business";
  payment_customer_id?: string;
  payment_subscription_id?: string;
  payment_provider?: string;
  subscription_expires_at?: Date;
  is_active: boolean;
  is_admin?: boolean;
  created_at: Date;
  // Multi-channel support (up to 5)
  connected_channels?: ConnectedChannel[];
  // Legacy single-channel fields (kept for backward compat — migrated on read)
  youtube_refresh_token?: string;
  youtube_channel?: {
    channel_id: string;
    channel_title: string;
    connected_at: Date;
  };
  instagram_access_token?: string;
  instagram_token_updated_at?: Date;
  instagram_account?: {
    ig_user_id: string;
    username: string;
    connected_at: Date;
  };
}

/** Get all connected channels, migrating legacy single-channel fields into the array. */
export function getChannels(user: DbUser): ConnectedChannel[] {
  const channels: ConnectedChannel[] = [...(user.connected_channels ?? [])];

  // Migrate legacy YouTube if not already in array
  if (user.youtube_refresh_token && user.youtube_channel) {
    const exists = channels.some(
      (c) => c.platform === "youtube" && c.platform_account_id === user.youtube_channel!.channel_id
    );
    if (!exists) {
      channels.push({
        id: "legacy_yt",
        platform: "youtube",
        platform_account_id: user.youtube_channel.channel_id,
        account_name: user.youtube_channel.channel_title,
        refresh_token: user.youtube_refresh_token,
        connected_at: user.youtube_channel.connected_at,
      });
    }
  }

  // Migrate legacy Instagram if not already in array
  if (user.instagram_access_token && user.instagram_account) {
    const exists = channels.some(
      (c) => c.platform === "instagram" && c.platform_account_id === user.instagram_account!.ig_user_id
    );
    if (!exists) {
      channels.push({
        id: "legacy_ig",
        platform: "instagram",
        platform_account_id: user.instagram_account.ig_user_id,
        account_name: user.instagram_account.username,
        access_token: user.instagram_access_token,
        token_updated_at: user.instagram_token_updated_at,
        connected_at: user.instagram_account.connected_at,
      });
    }
  }

  return channels;
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
  faceless_script_type?: string;
  faceless_style?: string;
  faceless_voice?: string;
  faceless_duration?: number;
  faceless_music?: string;
  faceless_text_style?: string;
  // Auto-publish config (set at creation, processed by scheduler Lambda)
  auto_publish_config?: {
    platforms: { platform: "youtube" | "instagram"; channel_id: string }[];
    visibility?: string;
    scheduled_at?: string;
  };
  auto_publish_processed?: boolean;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

export interface DbScheduledPublish {
  _id?: ObjectId;
  user_id: ObjectId;
  job_id: ObjectId;
  clip_index: number;
  platform: "youtube" | "instagram";
  channel_id: string;
  // Publishing metadata
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: string;
  // Schedule
  scheduled_at: Date;
  status: "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  error_message?: string;
  // Result
  published_url?: string;
  platform_id?: string;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
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

let _scheduleIndexesEnsured = false;

export async function scheduledPublishesCol(): Promise<Collection<DbScheduledPublish>> {
  const col = (await getDb()).collection<DbScheduledPublish>("scheduled_publishes");
  if (!_scheduleIndexesEnsured) {
    _scheduleIndexesEnsured = true;
    col.createIndex({ status: 1, scheduled_at: 1 }).catch(() => {});
    col.createIndex({ user_id: 1, status: 1 }).catch(() => {});
    col.createIndex({ job_id: 1 }).catch(() => {});
  }
  return col;
}

// ── Automations ─────────────────────────────────────────────────────────────

export interface DbAutomation {
  _id?: ObjectId;
  user_id: ObjectId;
  name: string;
  is_active: boolean;
  // Topics (rotates 1 per day)
  topics: string[];
  topic_index: number;
  // Video settings
  script_type: string;
  style: string;
  voice: string;
  music: string;
  duration: number;
  // Schedule
  post_hour: number; // 0-23 UTC
  // Publishing
  platforms: { platform: "youtube" | "instagram"; channel_id: string }[];
  visibility: string;
  // Stats
  total_runs: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbAutomationRun {
  _id?: ObjectId;
  automation_id: ObjectId;
  user_id: ObjectId;
  scheduled_post_at: Date;
  topic: string;
  status: "pending" | "generating" | "ready" | "published" | "failed";
  job_id?: ObjectId;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

let _automationIndexesEnsured = false;
let _automationRunIndexesEnsured = false;

export async function automationsCol(): Promise<Collection<DbAutomation>> {
  const col = (await getDb()).collection<DbAutomation>("automations");
  if (!_automationIndexesEnsured) {
    _automationIndexesEnsured = true;
    col.createIndex({ user_id: 1 }).catch(() => {});
  }
  return col;
}

export async function automationRunsCol(): Promise<Collection<DbAutomationRun>> {
  const col = (await getDb()).collection<DbAutomationRun>("automation_runs");
  if (!_automationRunIndexesEnsured) {
    _automationRunIndexesEnsured = true;
    col.createIndex({ status: 1, scheduled_post_at: 1 }).catch(() => {});
    col.createIndex({ automation_id: 1, scheduled_post_at: -1 }).catch(() => {});
  }
  return col;
}

// ── OAuth State (CSRF protection) ───────────────────────────────────────────

export interface DbOAuthState {
  _id?: ObjectId;
  state: string;
  user_id: ObjectId;
  created_at: Date;
}

let _oauthStateIndexesEnsured = false;

export async function oauthStatesCol(): Promise<Collection<DbOAuthState>> {
  const col = (await getDb()).collection<DbOAuthState>("oauth_states");
  if (!_oauthStateIndexesEnsured) {
    _oauthStateIndexesEnsured = true;
    col.createIndex({ state: 1 }, { unique: true }).catch(() => {});
    col.createIndex({ created_at: 1 }, { expireAfterSeconds: 600 }).catch(() => {}); // auto-delete after 10min
  }
  return col;
}

export { ObjectId };
