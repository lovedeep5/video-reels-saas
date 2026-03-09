import axios from "axios";
import { clearPlanMeta } from "./auth";

const api = axios.create({ baseURL: "/api" });

// Attach Clerk JWT to every request.
// getToken is stored on window so it works across all module instances
// regardless of how Next.js/Turbopack chunks the code.
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const getToken = (window as any).__clerkGetToken as
      | (() => Promise<string | null>)
      | undefined;
    if (getToken) {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.error("[api] getToken() threw:", e);
      }
    }
  }
  return config;
});

// On 401, clear cached plan meta
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      clearPlanMeta();
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: string;
}

export interface Clip {
  id: string | number;
  clip_index: number;
  start_time: number;
  end_time: number;
  duration: number;
  importance_score: number;
  transcript_excerpt: string | null;
  file_ready: boolean;
  s3_key: string | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
}

export interface Job {
  id: string;
  status: string;
  progress: number;
  progress_message: string;
  source_type: string;
  source_url: string | null;
  source_filename: string | null;
  video_title: string | null;
  video_duration: number | null;
  clips_requested: number;
  output_ratio: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  clips: Clip[];
}

export interface Plan {
  key: string;
  name: string;
  price: number;
  currency: string;
  clips_per_video: number;
  videos_per_month: number;
  max_duration_seconds: number;
  features: string[];
  razorpay_plan_id: string | null;
}

// ── API helpers ────────────────────────────────────────────────────────────

export const authApi = {
  me: () => api.get<AuthUser>("/auth/me"),
};

export const videoApi = {
  submitUrl: (url: string, clipsRequested: number, outputRatio: string = "9:16") =>
    api.post("/videos/submit-url", { url, clips_requested: clipsRequested, output_ratio: outputRatio }),

  upload: (file: File, clipsRequested: number, outputRatio: string = "9:16") => {
    const form = new FormData();
    form.append("file", file);
    form.append("clips_requested", String(clipsRequested));
    form.append("output_ratio", outputRatio);
    return api.post("/videos/upload", form);
  },
};

export interface Usage {
  videos_used: number;
  videos_limit: number;
  clips_per_video: number;
  plan: string;
}

export const jobsApi = {
  list: () => api.get<Job[]>("/jobs"),
  get: (id: string) => api.get<Job>(`/jobs/${id}`),
  usage: () => api.get<Usage>("/jobs/usage"),
  deleteFailed: (id: string) => api.delete(`/jobs/${id}`),
  retry: (id: string) => api.post(`/jobs/${id}/retry`),
  downloadUrl: (jobId: string, clipId: string | number) => `/api/jobs/${jobId}/clips/${clipId}/download`,
};

export const billingApi = {
  plans: () => api.get<Plan[]>("/billing/plans"),
  status: () => api.get("/billing/status"),
  subscribe: (plan_key: string) =>
    api.post<{
      order_id: string;
      key_id: string;
      amount: number;
      currency: string;
      plan_key: string;
      plan_name: string;
      prefill: { name: string; email: string };
    }>("/billing/subscribe", { plan_key }),
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan_key: string;
  }) => api.post<{ status: string; plan: string }>("/billing/verify-payment", data),
  cancel: () => api.post("/billing/cancel"),
};

// ── API Keys ───────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
}

export interface ApiKeyCreated extends ApiKey {
  full_key: string;
}

export type ExpiryOption = "week" | "month" | "3months" | "year" | "custom" | "never";

export const keysApi = {
  list: () => api.get<ApiKey[]>("/keys"),
  create: (name: string, expiry: ExpiryOption, custom_expires_at?: string) =>
    api.post<ApiKeyCreated>("/keys", { name, expiry, custom_expires_at }),
  revoke: (id: string) => api.delete(`/keys/${id}`),
};

// ── YouTube ─────────────────────────────────────────────────────────────────

export interface YouTubeStatus {
  connected: boolean;
  configured: boolean;
  channel?: { channel_id: string; channel_title: string; connected_at: string } | null;
}

export interface YouTubeMetaSuggestion {
  title: string;
  description: string;
  tags: string[];
}

export interface YouTubePublishResult {
  youtube_video_id: string;
  youtube_url: string;
}

export const cookiesApi = {
  status: () =>
    api.get<{
      synced: boolean;
      needs_refresh?: boolean;
      last_modified?: string | null;
      last_job_at?: string | null;
    }>("/cookies/status"),
};

export const youtubeApi = {
  status: () => api.get<YouTubeStatus>("/youtube/status"),
  disconnect: () => api.post("/youtube/disconnect"),
  suggestMetadata: (data: {
    transcript: string | null;
    video_title: string | null;
    clip_index: number;
    duration: number;
  }) => api.post<YouTubeMetaSuggestion>("/youtube/suggest-metadata", data),
  publish: (
    jobId: string,
    clipId: number,
    data: { title: string; description: string; tags: string[]; visibility: string }
  ) => api.post<YouTubePublishResult>(`/jobs/${jobId}/clips/${clipId}/publish-youtube`, data),
};
