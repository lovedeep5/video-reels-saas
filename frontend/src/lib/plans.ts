export const PLANS = {
  free: {
    name: "Starter",
    price: 0,
    currency: "INR",
    clips_per_video: 1,
    videos_per_month: 2,
    max_duration_seconds: 30,
    razorpay_plan_id: null,
    scheduled_publish: false,
    auto_publish: false,
    features: [
      "2 videos/month",
      "Up to 30 seconds",
      "12 AI visual styles",
      "20+ AI voices",
      "Manual publishing only",
    ],
  },
  creator: {
    name: "Creator",
    price: 499,
    currency: "INR",
    clips_per_video: 3,
    videos_per_month: 15,
    max_duration_seconds: 180,
    razorpay_plan_id: null,
    scheduled_publish: true,
    auto_publish: false,
    features: [
      "15 videos/month",
      "Up to 3 minutes",
      "Scheduled publishing",
      "YouTube & Instagram",
      "No watermark",
    ],
  },
  pro: {
    name: "Pro",
    price: 1499,
    currency: "INR",
    clips_per_video: 10,
    videos_per_month: 50,
    max_duration_seconds: 600,
    razorpay_plan_id: null,
    scheduled_publish: true,
    auto_publish: true,
    features: [
      "50 videos/month",
      "Up to 10 minutes",
      "Auto-post on creation",
      "All platforms",
      "Priority queue",
    ],
  },
  business: {
    name: "Business",
    price: 3999,
    currency: "INR",
    clips_per_video: 20,
    videos_per_month: -1,
    max_duration_seconds: 3600,
    razorpay_plan_id: null,
    scheduled_publish: true,
    auto_publish: true,
    features: [
      "Unlimited videos",
      "Up to 60 minutes",
      "Auto-post + batch creation",
      "Full API access",
      "Dedicated support",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlan(key: string) {
  return PLANS[key as PlanKey] ?? PLANS.free;
}

export function isPaidPlan(key: string): boolean {
  return key === "creator" || key === "pro" || key === "business";
}

// Debit on submission (queued). Refund automatically if job fails (failed excluded).
// Retry creates a new job doc → debit again. Old failed doc is deleted.
const BILLABLE_STATUSES = ["queued", "starting", "downloading", "processing", "rendering", "completed"] as const;
export { BILLABLE_STATUSES };
