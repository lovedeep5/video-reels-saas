export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    currency: "INR",
    clips_per_video: 3,
    videos_per_month: 2,
    max_duration_seconds: 0,
    razorpay_plan_id: null,
    features: ["3 clips per video", "2 videos/month", "No duration limit"],
  },
  pro: {
    name: "Pro",
    price: 1499,
    currency: "INR",
    clips_per_video: 10,
    videos_per_month: 20,
    max_duration_seconds: 3600,
    razorpay_plan_id: null,
    features: ["10 clips per video", "20 videos/month", "Max 60 min video"],
  },
  business: {
    name: "Business",
    price: 3999,
    currency: "INR",
    clips_per_video: 20,
    videos_per_month: -1,
    max_duration_seconds: 10800,
    razorpay_plan_id: null,
    features: ["20 clips per video", "Unlimited videos", "Max 3 hr video", "Priority queue"],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlan(key: string) {
  return PLANS[key as PlanKey] ?? PLANS.free;
}

// Count ALL non-deleted jobs immediately on submission.
// Retrying a failed job reuses the same document — count stays the same.
// Deleting a failed job removes the document — count decreases (fair refund).
const BILLABLE_STATUSES = ["queued", "starting", "downloading", "processing", "rendering", "completed", "failed"] as const;
export { BILLABLE_STATUSES };
