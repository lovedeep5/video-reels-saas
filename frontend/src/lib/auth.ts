// Auth is handled by Clerk (session token, sign-in, sign-out).
// This file only caches plan/profile data fetched from our backend API.

const PLAN_KEY = "vr_plan_meta";

export interface AppUserMeta {
  id: string;
  name: string;
  email: string;
  plan: string;
  is_admin?: boolean;
}

export function savePlanMeta(meta: AppUserMeta) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAN_KEY, JSON.stringify(meta));
}

export function getPlanMeta(): AppUserMeta | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(PLAN_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearPlanMeta() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PLAN_KEY);
}
